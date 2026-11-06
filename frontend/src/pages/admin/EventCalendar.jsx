import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar as CalendarIcon,
    Plus,
    Clock,
    X,
    Trash2,
    Users,
    Pencil,
    Ticket,
    Eye,
    EyeOff
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import TargetSelector from '../../components/TargetSelector';
import EventPoster from '../../components/EventPoster';

const DEFAULT_EVENT_REGISTRATION_FIELDS = [
    { id: 'student-name', label: 'Student Full Name', type: 'text', required: true },
    { id: 'pin-number', label: 'PIN / Roll Number', type: 'text', required: true },
    { id: 'college', label: 'College', type: 'text', required: true },
    { id: 'branch', label: 'Department / Branch', type: 'text', required: true },
    { id: 'year-semester', label: 'Year & Semester', type: 'text', required: true },
    { id: 'mobile-number', label: 'Mobile Number', type: 'text', required: true },
    { id: 'email', label: 'Email ID', type: 'text', required: false }
];

const EventCalendar = ({
    isEmbedded = false,
    announcementEvents = [],
    onOpenAnnouncement,
    onEditAnnouncement,
    onToggleAnnouncement,
    onDeleteAnnouncement
}) => {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);

    // Form State
    const initialFormState = {
        title: '',
        description: '',
        image_url: '',
        event_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        event_type: 'event',
        requires_registration: false,
        max_seats: '',
        registration_deadline: '',
        registration_form_fields: DEFAULT_EVENT_REGISTRATION_FIELDS.map(field => ({ ...field })),
        target_college: [],
        target_batch: [],
        target_course: [],
        target_branch: [],
        target_year: [],
        target_semester: []
    };
    const [formData, setFormData] = useState(initialFormState);
    const [editId, setEditId] = useState(null);
    const [formStep, setFormStep] = useState(1);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const response = await api.get('/events/admin');
            if (response.data.success) {
                setEvents(response.data.data);
            }
        } catch (error) {
            toast.error('Failed to load events');
        }
    };

    const handleEditEvent = (event, e) => {
        e.stopPropagation();
        setEditId(event.id);

        const parseField = (val) => {
            if (!val) return [];
            return Array.isArray(val) ? val : (typeof val === 'string' ? JSON.parse(val) : []);
        };

        // Convert UTC date to IST date string for input
        const eventDate = new Date(event.event_date);
        const istDate = new Date(eventDate.getTime() + (5.5 * 60 * 60 * 1000));
        const formattedDate = istDate.toISOString().split('T')[0];

        let formattedEndDate = '';
        if (event.end_date) {
            const endDateObj = new Date(event.end_date);
            const istEndDate = new Date(endDateObj.getTime() + (5.5 * 60 * 60 * 1000));
            formattedEndDate = istEndDate.toISOString().split('T')[0];
        } else {
            formattedEndDate = formattedDate;
        }

        setFormData({
            title: event.title,
            description: event.description || '',
            image_url: event.image_url || '',
            event_date: formattedDate,
            end_date: formattedEndDate,
            start_time: event.start_time || '',
            end_time: event.end_time || '',
            event_type: event.event_type,
            requires_registration: Boolean(event.requires_registration),
            max_seats: event.max_seats || '',
            registration_deadline: event.registration_deadline
                ? new Date(new Date(event.registration_deadline).getTime() - new Date(event.registration_deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                : '',
            registration_form_fields: parseField(event.registration_form_fields).length > 0
                ? parseField(event.registration_form_fields)
                : DEFAULT_EVENT_REGISTRATION_FIELDS.map(field => ({ ...field })),
            target_college: parseField(event.target_college),
            target_batch: parseField(event.target_batch),
            target_course: parseField(event.target_course),
            target_branch: parseField(event.target_branch),
            target_year: parseField(event.target_year),
            target_semester: parseField(event.target_semester)
        });
        setFormStep(1);
        setIsModalOpen(true);
    };

    const handleViewEvent = async (event) => {
        setSelectedEvent(event);
    };

    const updateRegistrationField = (index, key, value) => {
        setFormData(current => ({
            ...current,
            registration_form_fields: current.registration_form_fields.map((field, fieldIndex) => (
                fieldIndex === index ? { ...field, [key]: value } : field
            ))
        }));
    };

    const handlePosterChange = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Choose an image file for the event poster');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Event poster must be 5 MB or smaller');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setFormData(current => ({ ...current, image_url: String(reader.result || '') }));
        reader.onerror = () => toast.error('Failed to read event poster');
        reader.readAsDataURL(file);
    };

    const handleDeleteEvent = async (id, e) => {
        e?.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this event?')) return;
        try {
            await api.delete(`/events/${id}`);
            toast.success('Event deleted');
            if (selectedEvent?.id === id) setSelectedEvent(null);
            if (editId === id) setIsModalOpen(false);
            fetchEvents();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete event');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formStep === 1) {
            if (!formData.title.trim() || !formData.event_date) {
                toast.error('Enter an event title and start date to continue');
                return;
            }
            setFormStep(2);
            return;
        }
        setLoading(true);

        const payload = {
            ...formData,
            registration_deadline: formData.registration_deadline
                ? formData.registration_deadline.replace('T', ' ')
                : '',
            registration_form_fields: formData.requires_registration
                ? formData.registration_form_fields.filter(field => field.label?.trim())
                : []
        };

        try {
            if (editId) {
                await api.put(`/events/${editId}`, payload);
                toast.success('Event updated');
            } else {
                await api.post('/events', payload);
                toast.success('Event created');
            }
            setIsModalOpen(false);
            fetchEvents();
        } catch (error) {
            console.error(error);
            toast.error('Failed to save event');
        } finally {
            setLoading(false);
        }
    };

    const getEventTypeColor = (type) => {
        switch (type) {
            case 'holiday': return 'bg-[var(--danger-light)] text-danger border-[var(--danger-light)]';
            case 'exam': return 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]';
            case 'academic': return 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]';
            case 'event': return 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]';
            default: return 'bg-background text-sub border-border';
        }
    };
    const sortedEvents = events
        .filter(event => String(event.event_type || '').toLowerCase() === 'event')
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
    const unifiedEvents = [
        ...sortedEvents.map(event => ({ ...event, source: 'calendar' })),
        ...announcementEvents.map(event => ({ ...event, source: 'announcement' }))
    ].sort((a, b) => {
        const dateA = new Date(a.event_date || a.created_at || 0).getTime();
        const dateB = new Date(b.event_date || b.created_at || 0).getTime();
        return dateB - dateA;
    });

    return (
        <div className={`min-h-screen bg-[var(--background)]/50 p-6 space-y-6 animate-fade-in ${isEmbedded ? '!min-h-0 !p-1' : ''}`}>
            {!isEmbedded && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-main heading-font flex items-center gap-2">
                            <CalendarIcon className="text-primary" /> Events
                        </h1>
                        <p className="text-muted-text">Manage events and registrations by event type.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
                {isEmbedded && (
                    <button
                        type="button"
                        onClick={() => { setEditId(null); setFormData(initialFormState); setFormStep(1); setIsModalOpen(true); }}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                    >
                        <Plus size={17} /> Add Event
                    </button>
                )}
                {!isEmbedded && (
                    <button
                        type="button"
                        onClick={() => { setEditId(null); setFormData(initialFormState); setFormStep(1); setIsModalOpen(true); }}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                    >
                        <Plus size={17} /> Add Event
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {unifiedEvents.map(event => event.source === 'announcement' ? (
                    <div
                        key={`announcement-${event.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenAnnouncement?.(event)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onOpenAnnouncement?.(event);
                            }
                        }}
                        className={`group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md ${!event.is_active ? 'opacity-75 grayscale' : ''}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[10px] font-bold uppercase text-purple-700">
                                Event Announcement
                            </span>
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                    type="button"
                                    onClick={() => onToggleAnnouncement?.(event)}
                                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                                    title={event.is_active ? 'Hide event' : 'Show event'}
                                >
                                    {event.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onEditAnnouncement?.(event)}
                                    className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                                    title="Edit event announcement"
                                >
                                    <Pencil size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDeleteAnnouncement?.(event)}
                                    className="rounded p-1.5 text-red-600 hover:bg-red-50"
                                    title="Delete event announcement"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                        {event.image_url && (
                            <div className="mt-4 h-40 overflow-hidden rounded-xl">
                                <img src={event.image_url} alt="" className="h-full w-full object-cover" />
                            </div>
                        )}
                        <div className="mt-3 flex items-start justify-between gap-3">
                            <h2 className="text-base font-bold text-gray-900 group-hover:text-blue-700">{event.title}</h2>
                            <span className="shrink-0 text-xs font-semibold text-gray-500">
                                {event.event_date ? new Date(event.event_date).toLocaleDateString() : new Date(event.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p className="mt-1 line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-gray-500">
                            {event.content || event.event_venue || 'No description provided.'}
                        </p>
                        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5">
                                <Clock size={13} />
                                {[event.event_time, event.event_venue].filter(Boolean).join(' · ') || 'Time and venue TBA'}
                            </span>
                            {event.requires_registration && (
                                <span className="flex items-center gap-1.5 font-semibold text-indigo-600">
                                    <Users size={14} /> {event.registered_count || 0}{event.max_seats ? ` / ${event.max_seats}` : ''} registered
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <button
                        key={event.id}
                        type="button"
                        onClick={() => handleViewEvent(event)}
                        className="group rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--primary-light)] hover:shadow-md"
                    >
                        {String(event.event_type || '').toLowerCase() !== 'exam' && (
                            <div className="mb-4 h-40 overflow-hidden rounded-xl">
                                <EventPoster event={event} />
                            </div>
                        )}
                        <div className="flex items-start justify-between gap-3">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getEventTypeColor(event.event_type)}`}>
                                {event.event_type || 'other'}
                            </span>
                            <span className="text-xs font-semibold text-muted-text">
                                {new Date(event.event_date).toLocaleDateString()}
                            </span>
                        </div>
                        <h2 className="mt-3 text-base font-bold text-main group-hover:text-primary">{event.title}</h2>
                        <p className="mt-1 line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-muted-text">
                            {event.description || 'No description provided.'}
                        </p>
                        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-text">
                            <span className="flex items-center gap-1.5"><Clock size={13} />{event.start_time || 'All day'}</span>
                            {event.requires_registration && (
                                <span className="flex items-center gap-1.5 font-semibold text-primary">
                                    <Users size={14} /> {event.registered_count || 0}{event.max_seats ? ` / ${event.max_seats}` : ''} registered
                                </span>
                            )}
                        </div>
                    </button>
                ))}
                {unifiedEvents.length === 0 && (
                    <div className="col-span-full rounded-2xl border border-dashed border-border-strong bg-surface py-16 text-center text-muted-text">
                        <CalendarIcon className="mx-auto mb-3 text-muted-text" size={32} />
                        No events created yet.
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-surface z-10">
                            <div>
                                <h2 className="text-xl font-bold">{editId ? 'Edit Event' : 'Create Event'}</h2>
                                <p className="mt-1 text-xs text-muted-text">Step {formStep} of 2: {formStep === 1 ? 'Event details and audience' : 'Registration settings'}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-background rounded-full"><X size={20} /></button>
                        </div>
                        <div className="flex items-center gap-3 border-b bg-background px-6 py-3">
                            {[1, 2].map(step => (
                                <button
                                    key={step}
                                    type="button"
                                    onClick={() => {
                                        if (step === 2 && (!formData.title.trim() || !formData.event_date)) {
                                            toast.error('Enter an event title and start date to continue');
                                            return;
                                        }
                                        setFormStep(step);
                                    }}
                                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${formStep === step ? 'bg-primary text-white' : 'text-sub hover:bg-background'}`}
                                >
                                    {step === 1 ? '1. Event details & audience' : '2. Registration'}
                                </button>
                            ))}
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className={`grid grid-cols-1 ${formStep === 1 ? 'md:grid-cols-2' : ''} gap-6`}>
                                    <div className="space-y-4">
                                        {formStep === 1 && (
                                            <>
                                        <div>
                                            <label className="block text-sm font-medium text-sub mb-1">Event Title</label>
                                            <input
                                                required={formStep === 1}
                                                type="text"
                                                className="w-full p-2 border rounded-lg"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-sub mb-1">Start Date</label>
                                                <input
                                                    required={formStep === 1}
                                                    type="date"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.event_date}
                                                    onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-sub mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.end_date}
                                                    min={formData.event_date}
                                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-sub mb-1">Start Time (Optional)</label>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.start_time}
                                                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-sub mb-1">End Time (Optional)</label>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.end_time}
                                                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-sub mb-1">Description</label>
                                            <textarea
                                                className="w-full p-2 border rounded-lg h-32"
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            ></textarea>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-sub">Event poster (optional)</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={event => handlePosterChange(event.target.files?.[0])}
                                                className="block w-full rounded-lg border border-border p-2 text-sm"
                                            />
                                            <div className="h-40 overflow-hidden rounded-xl border border-border">
                                                <EventPoster event={formData} />
                                            </div>
                                            {formData.image_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(current => ({ ...current, image_url: '' }))}
                                                    className="text-xs font-medium text-danger hover:underline"
                                                >
                                                    Remove poster and use default
                                                </button>
                                            )}
                                        </div>
                                            </>
                                        )}
                                        <div className={`rounded-xl border border-[var(--primary-light)] bg-[var(--primary-light)] p-4 space-y-3 ${formStep === 1 ? 'hidden' : ''}`}>
                                            <label className="flex items-center justify-between gap-3 cursor-pointer">
                                                <span>
                                                    <span className="block text-sm font-semibold text-main">Enable registrations</span>
                                                    <span className="block text-xs text-muted-text">Let eligible students register for this event.</span>
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.requires_registration}
                                                    onChange={e => setFormData({ ...formData, requires_registration: e.target.checked })}
                                                    className="h-4 w-4 rounded text-primary"
                                                />
                                            </label>
                                            {formData.requires_registration && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <label className="text-xs font-medium text-sub">
                                                            Seat capacity (optional)
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={formData.max_seats}
                                                                onChange={e => setFormData({ ...formData, max_seats: e.target.value })}
                                                                className="mt-1 w-full rounded-lg border p-2 text-sm"
                                                            />
                                                        </label>
                                                        <label className="text-xs font-medium text-sub">
                                                            Registration deadline
                                                            <input
                                                                type="datetime-local"
                                                                value={formData.registration_deadline}
                                                                onChange={e => setFormData({ ...formData, registration_deadline: e.target.value })}
                                                                className="mt-1 w-full rounded-lg border p-2 text-sm"
                                                            />
                                                        </label>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span>
                                                                <span className="block text-xs font-semibold text-sub">Basic student questions</span>
                                                                <span className="block text-[11px] text-muted-text">Edit or remove these fields, or add event-specific questions.</span>
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData(current => ({
                                                                    ...current,
                                                                    registration_form_fields: [
                                                                        ...current.registration_form_fields,
                                                                        { id: `field-${Date.now()}`, label: '', type: 'text', required: false }
                                                                    ]
                                                                }))}
                                                                className="text-xs font-semibold text-primary hover:underline"
                                                            >
                                                                Add question
                                                            </button>
                                                        </div>
                                                        {formData.registration_form_fields.map((field, index) => (
                                                            <div key={field.id || index} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                                                                <input
                                                                    value={field.label || ''}
                                                                    onChange={e => updateRegistrationField(index, 'label', e.target.value)}
                                                                    placeholder="Question"
                                                                    className="min-w-0 rounded-lg border p-2 text-xs"
                                                                />
                                                                <select
                                                                    value={field.type || 'text'}
                                                                    onChange={e => updateRegistrationField(index, 'type', e.target.value)}
                                                                    className="rounded-lg border p-2 text-xs"
                                                                >
                                                                    <option value="text">Short text</option>
                                                                    <option value="textarea">Long text</option>
                                                                </select>
                                                                <div className="flex items-center gap-2">
                                                                    <label className="flex items-center gap-1 text-[10px] text-sub">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={Boolean(field.required)}
                                                                            onChange={e => updateRegistrationField(index, 'required', e.target.checked)}
                                                                        />
                                                                        Required
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setFormData(current => ({
                                                                            ...current,
                                                                            registration_form_fields: current.registration_form_fields.filter((_, i) => i !== index)
                                                                        }))}
                                                                        className="text-danger hover:text-danger"
                                                                        aria-label="Remove question"
                                                                    >
                                                                        <X size={15} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {formStep === 1 && <div className="bg-background p-4 rounded-xl border">
                                        <TargetSelector formData={formData} setFormData={setFormData} />
                                    </div>}
                                </div>

                                <div className="flex justify-between pt-4 border-t">
                                    {editId && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteEvent(editId, e)}
                                            className="px-4 py-2 text-danger hover:bg-[var(--danger-light)] rounded-lg flex items-center gap-2"
                                        >
                                            <Trash2 size={18} /> Delete Event
                                        </button>
                                    )}
                                    <div className="flex gap-3 ml-auto">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sub hover:bg-background rounded-lg">Cancel</button>
                                        {formStep === 2 && (
                                            <button type="button" onClick={() => setFormStep(1)} className="px-5 py-2 rounded-lg border border-border-strong text-sub hover:bg-background font-medium">
                                                Back
                                            </button>
                                        )}
                                        {formStep === 1 ? (
                                            <button
                                                type="submit"
                                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium"
                                            >
                                                Next
                                            </button>
                                        ) : (
                                            <button type="submit" disabled={loading} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium">
                                                {loading ? <Clock className="animate-spin" /> : (editId ? 'Update Event' : 'Create Event')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {selectedEvent && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b p-5">
                            <div>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getEventTypeColor(selectedEvent.event_type)}`}>
                                    {selectedEvent.event_type || 'other'}
                                </span>
                                <h2 className="mt-2 text-xl font-bold text-main">{selectedEvent.title}</h2>
                                <p className="mt-1 text-sm text-muted-text">
                                    {new Date(selectedEvent.event_date).toLocaleDateString()}
                                    {selectedEvent.start_time ? ` · ${selectedEvent.start_time}` : ' · All day'}
                                </p>
                            </div>
                            <button onClick={() => setSelectedEvent(null)} className="rounded-full p-2 text-muted-text hover:bg-background" aria-label="Close event details">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-5 overflow-y-auto p-5">
                            {String(selectedEvent.event_type || '').toLowerCase() !== 'exam' && (
                                <div className="h-48 overflow-hidden rounded-xl">
                                    <EventPoster event={selectedEvent} />
                                </div>
                            )}
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-sub">
                                {selectedEvent.description || 'No description provided.'}
                            </p>
                            <section className="rounded-xl border border-border p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="flex items-center gap-2 font-semibold text-main">
                                        <Ticket size={17} className="text-primary" /> Registrations
                                    </h3>
                                    <span className="text-xs text-muted-text">
                                        {selectedEvent.registered_count ?? 0}
                                        {selectedEvent.max_seats ? ` / ${selectedEvent.max_seats}` : ''}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-muted-text">
                                    {selectedEvent.requires_registration
                                        ? 'View, filter, and export the student registration list.'
                                        : 'Registration is not enabled for this event.'}
                                </p>
                                <button
                                    type="button"
                                    disabled={!selectedEvent.requires_registration}
                                    onClick={() => navigate(`/events/${selectedEvent.id}/registrations`)}
                                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Users size={14} /> Manage Registrations
                                </button>
                            </section>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                                    className="mr-auto inline-flex items-center gap-2 rounded-lg border border-[var(--danger-light)] px-4 py-2 text-sm font-semibold text-danger hover:bg-[var(--danger-light)]"
                                >
                                    <Trash2 size={15} /> Delete Event
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        const eventToEdit = selectedEvent;
                                        setSelectedEvent(null);
                                        handleEditEvent(eventToEdit, e);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary hover:bg-[var(--primary-light)]"
                                >
                                    <Pencil size={15} /> Edit Event
                                </button>
                                <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-lg bg-sidebar px-4 py-2 text-sm font-semibold text-white">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventCalendar;
