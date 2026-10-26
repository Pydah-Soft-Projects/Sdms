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
    Ticket
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

const EventCalendar = ({ isEmbedded = false }) => {
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
            case 'holiday': return 'bg-red-100 text-red-700 border-red-200';
            case 'exam': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'academic': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'event': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };
    const sortedEvents = events
        .filter(event => String(event.event_type || '').toLowerCase() === 'event')
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

    return (
        <div className={`min-h-screen bg-gray-50/50 p-6 space-y-6 animate-fade-in ${isEmbedded ? '!min-h-0 !p-1' : ''}`}>
            {!isEmbedded && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 heading-font flex items-center gap-2">
                            <CalendarIcon className="text-blue-600" /> Events
                        </h1>
                        <p className="text-gray-500">Manage events and registrations by event type.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
                {isEmbedded && (
                    <button
                        type="button"
                        onClick={() => { setEditId(null); setFormData(initialFormState); setFormStep(1); setIsModalOpen(true); }}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                        <Plus size={17} /> Add Event
                    </button>
                )}
                {!isEmbedded && (
                    <button
                        type="button"
                        onClick={() => { setEditId(null); setFormData(initialFormState); setFormStep(1); setIsModalOpen(true); }}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                        <Plus size={17} /> Add Event
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sortedEvents.map(event => (
                    <button
                        key={event.id}
                        type="button"
                        onClick={() => handleViewEvent(event)}
                        className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
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
                            <span className="text-xs font-semibold text-gray-500">
                                {new Date(event.event_date).toLocaleDateString()}
                            </span>
                        </div>
                        <h2 className="mt-3 text-base font-bold text-gray-900 group-hover:text-blue-700">{event.title}</h2>
                        <p className="mt-1 line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-gray-500">
                            {event.description || 'No description provided.'}
                        </p>
                        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5"><Clock size={13} />{event.start_time || 'All day'}</span>
                            {event.requires_registration && (
                                <span className="flex items-center gap-1.5 font-semibold text-indigo-600">
                                    <Users size={14} /> {event.registered_count || 0}{event.max_seats ? ` / ${event.max_seats}` : ''} registered
                                </span>
                            )}
                        </div>
                    </button>
                ))}
                {sortedEvents.length === 0 && (
                    <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500">
                        <CalendarIcon className="mx-auto mb-3 text-gray-300" size={32} />
                        No events created yet.
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-xl font-bold">{editId ? 'Edit Event' : 'Create Event'}</h2>
                                <p className="mt-1 text-xs text-gray-500">Step {formStep} of 2: {formStep === 1 ? 'Event details and audience' : 'Registration settings'}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="flex items-center gap-3 border-b bg-gray-50 px-6 py-3">
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
                                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${formStep === step ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
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
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                                <input
                                                    required={formStep === 1}
                                                    type="date"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.event_date}
                                                    onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
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
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Start Time (Optional)</label>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.start_time}
                                                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">End Time (Optional)</label>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.end_time}
                                                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                            <textarea
                                                className="w-full p-2 border rounded-lg h-32"
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            ></textarea>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">Event poster (optional)</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={event => handlePosterChange(event.target.files?.[0])}
                                                className="block w-full rounded-lg border border-gray-200 p-2 text-sm"
                                            />
                                            <div className="h-40 overflow-hidden rounded-xl border border-gray-200">
                                                <EventPoster event={formData} />
                                            </div>
                                            {formData.image_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(current => ({ ...current, image_url: '' }))}
                                                    className="text-xs font-medium text-red-600 hover:underline"
                                                >
                                                    Remove poster and use default
                                                </button>
                                            )}
                                        </div>
                                            </>
                                        )}
                                        <div className={`rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3 ${formStep === 1 ? 'hidden' : ''}`}>
                                            <label className="flex items-center justify-between gap-3 cursor-pointer">
                                                <span>
                                                    <span className="block text-sm font-semibold text-gray-900">Enable registrations</span>
                                                    <span className="block text-xs text-gray-500">Let eligible students register for this event.</span>
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.requires_registration}
                                                    onChange={e => setFormData({ ...formData, requires_registration: e.target.checked })}
                                                    className="h-4 w-4 rounded text-indigo-600"
                                                />
                                            </label>
                                            {formData.requires_registration && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <label className="text-xs font-medium text-gray-600">
                                                            Seat capacity (optional)
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={formData.max_seats}
                                                                onChange={e => setFormData({ ...formData, max_seats: e.target.value })}
                                                                className="mt-1 w-full rounded-lg border p-2 text-sm"
                                                            />
                                                        </label>
                                                        <label className="text-xs font-medium text-gray-600">
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
                                                                <span className="block text-xs font-semibold text-gray-700">Basic student questions</span>
                                                                <span className="block text-[11px] text-gray-500">Edit or remove these fields, or add event-specific questions.</span>
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
                                                                className="text-xs font-semibold text-indigo-600 hover:underline"
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
                                                                    <label className="flex items-center gap-1 text-[10px] text-gray-600">
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
                                                                        className="text-red-500 hover:text-red-700"
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

                                    {formStep === 1 && <div className="bg-gray-50 p-4 rounded-xl border">
                                        <TargetSelector formData={formData} setFormData={setFormData} />
                                    </div>}
                                </div>

                                <div className="flex justify-between pt-4 border-t">
                                    {editId && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteEvent(editId, e)}
                                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                                        >
                                            <Trash2 size={18} /> Delete Event
                                        </button>
                                    )}
                                    <div className="flex gap-3 ml-auto">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                        {formStep === 2 && (
                                            <button type="button" onClick={() => setFormStep(1)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                                                Back
                                            </button>
                                        )}
                                        {formStep === 1 ? (
                                            <button
                                                type="submit"
                                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                            >
                                                Next
                                            </button>
                                        ) : (
                                            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
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
                    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b p-5">
                            <div>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getEventTypeColor(selectedEvent.event_type)}`}>
                                    {selectedEvent.event_type || 'other'}
                                </span>
                                <h2 className="mt-2 text-xl font-bold text-gray-900">{selectedEvent.title}</h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    {new Date(selectedEvent.event_date).toLocaleDateString()}
                                    {selectedEvent.start_time ? ` · ${selectedEvent.start_time}` : ' · All day'}
                                </p>
                            </div>
                            <button onClick={() => setSelectedEvent(null)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Close event details">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-5 overflow-y-auto p-5">
                            {String(selectedEvent.event_type || '').toLowerCase() !== 'exam' && (
                                <div className="h-48 overflow-hidden rounded-xl">
                                    <EventPoster event={selectedEvent} />
                                </div>
                            )}
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                {selectedEvent.description || 'No description provided.'}
                            </p>
                            <section className="rounded-xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                                        <Ticket size={17} className="text-indigo-600" /> Registrations
                                    </h3>
                                    <span className="text-xs text-gray-500">
                                        {selectedEvent.registered_count ?? 0}
                                        {selectedEvent.max_seats ? ` / ${selectedEvent.max_seats}` : ''}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    {selectedEvent.requires_registration
                                        ? 'View, filter, and export the student registration list.'
                                        : 'Registration is not enabled for this event.'}
                                </p>
                                <button
                                    type="button"
                                    disabled={!selectedEvent.requires_registration}
                                    onClick={() => navigate(`/events/${selectedEvent.id}/registrations`)}
                                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Users size={14} /> Manage Registrations
                                </button>
                            </section>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                                    className="mr-auto inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
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
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                                >
                                    <Pencil size={15} /> Edit Event
                                </button>
                                <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
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
