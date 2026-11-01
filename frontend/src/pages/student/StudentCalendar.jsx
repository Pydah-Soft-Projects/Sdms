import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Clock,
    CalendarCheck,
    X,
    Layers,
    BookOpen,
    Award,
    Sparkles,
    Sun,
    Tag,
    Search,
    ChevronRight as ArrowRightIcon,
    CalendarDays,
    LayoutGrid,
    Users
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { SkeletonBox } from '../../components/SkeletonLoader';
import EventPoster from '../../components/EventPoster';

const EVENT_TYPES = [
    { key: 'all', label: 'All Events', icon: Layers, badgeBg: 'bg-gray-900 text-white', activeTab: 'bg-gray-900 text-white shadow-md' },
    { key: 'academic', label: 'Academic', icon: BookOpen, badgeBg: 'bg-blue-100 text-blue-800 border-blue-200', activeTab: 'bg-blue-600 text-white shadow-md' },
    { key: 'exam', label: 'Exams', icon: Award, badgeBg: 'bg-amber-100 text-amber-800 border-amber-200', activeTab: 'bg-amber-500 text-white shadow-md' },
    { key: 'holiday', label: 'Holidays', icon: Sun, badgeBg: 'bg-rose-100 text-rose-800 border-rose-200', activeTab: 'bg-rose-600 text-white shadow-md' },
    { key: 'event', label: 'Events', icon: Sparkles, badgeBg: 'bg-purple-100 text-purple-800 border-purple-200', activeTab: 'bg-purple-600 text-white shadow-md' },
    { key: 'other', label: 'Other', icon: Tag, badgeBg: 'bg-gray-100 text-gray-700 border-gray-200', activeTab: 'bg-gray-700 text-white shadow-md' }
];

const parseLocalDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
        const clean = dateVal.trim();
        const dateMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            const y = parseInt(dateMatch[1], 10);
            const m = parseInt(dateMatch[2], 10);
            const day = parseInt(dateMatch[3], 10);
            return new Date(y, m - 1, day);
        }
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const parseExamTitle = (title) => {
    if (!title) return { code: '', subject: '', regulation: '' };
    const match = String(title).match(/^Paper:\s*([A-Za-z0-9_-]+)\s*-\s*(.+?)(?:\s*\(([^)]+)\))?$/i);
    if (match) {
        return {
            code: match[1].trim(),
            subject: match[2].trim(),
            regulation: match[3] ? match[3].trim() : ''
        };
    }
    return { code: '', subject: title, regulation: '' };
};

const cleanEventDescription = (desc) => {
    if (!desc) return '';
    return String(desc).replace(/\[.*?\]\s*/g, '').trim();
};

const parseRegistrationFields = (fields) => {
    if (!fields) return [];
    try {
        const parsed = typeof fields === 'string' ? JSON.parse(fields) : fields;
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

const StudentCalendar = () => {
    const location = useLocation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState('all');
    const [viewMode, setViewMode] = useState('cards');
    const [registrationResponses, setRegistrationResponses] = useState({});
    const [registrationSubmitting, setRegistrationSubmitting] = useState(false);

    const [calendarDays, setCalendarDays] = useState([]);
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);

    // Day View Modal for date cells with many events (+X more)
    const [showDayModal, setShowDayModal] = useState(false);
    const [selectedDayInfo, setSelectedDayInfo] = useState(null);
    const [daySearchQuery, setDaySearchQuery] = useState('');

    useEffect(() => {
        if (location.state?.initialDate) {
            setCurrentDate(new Date(location.state.initialDate));
        }
        fetchEvents();
    }, [location.state]);

    useEffect(() => {
        generateCalendar(currentDate, events, selectedType);
    }, [currentDate, events, selectedType]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const response = await api.get('/events/student');
            if (response.data.success) {
                setEvents(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load events:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateCalendar = (date, allEvents, activeType) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const filteredEvents = activeType === 'all'
            ? allEvents
            : allEvents.filter(e => (e.event_type || 'other').toLowerCase() === activeType);

        const days = [];
        for (let i = 0; i < startingDay; i++) {
            days.push({ day: null });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const currentDayDate = new Date(year, month, i);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            const dayEvents = filteredEvents.filter(e => {
                const eventStart = parseLocalDate(e.event_date);
                const eventEnd = e.end_date ? parseLocalDate(e.end_date) : eventStart;

                if (!eventStart) return false;
                return currentDayDate >= eventStart && currentDayDate <= (eventEnd || eventStart);
            });

            days.push({ day: i, date: dateStr, dateObj: currentDayDate, events: dayEvents });
        }
        setCalendarDays(days);
    };

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const getEventTypeStyle = (type) => {
        switch (type?.toLowerCase()) {
            case 'holiday':
                return {
                    badge: 'bg-rose-100 text-rose-700 border-rose-200',
                    pill: 'bg-rose-50/90 text-rose-700 border-rose-200 hover:bg-rose-100 hover:shadow-xs',
                    bar: 'bg-rose-500',
                    gradient: 'from-rose-600 via-pink-600 to-red-600'
                };
            case 'exam':
                return {
                    badge: 'bg-amber-100 text-amber-800 border-amber-200',
                    pill: 'bg-amber-50/90 text-amber-900 border-amber-200 hover:bg-amber-100 hover:shadow-xs',
                    bar: 'bg-amber-500',
                    gradient: 'from-amber-500 via-orange-500 to-amber-600'
                };
            case 'academic':
                return {
                    badge: 'bg-blue-100 text-blue-700 border-blue-200',
                    pill: 'bg-blue-50/90 text-blue-800 border-blue-200 hover:bg-blue-100 hover:shadow-xs',
                    bar: 'bg-blue-500',
                    gradient: 'from-blue-600 via-indigo-600 to-blue-700'
                };
            case 'event':
                return {
                    badge: 'bg-purple-100 text-purple-700 border-purple-200',
                    pill: 'bg-purple-50/90 text-purple-800 border-purple-200 hover:bg-purple-100 hover:shadow-xs',
                    bar: 'bg-purple-500',
                    gradient: 'from-purple-600 via-violet-600 to-fuchsia-600'
                };
            default:
                return {
                    badge: 'bg-gray-100 text-gray-700 border-gray-200',
                    pill: 'bg-gray-50/90 text-gray-800 border-gray-200 hover:bg-gray-100 hover:shadow-xs',
                    bar: 'bg-gray-500',
                    gradient: 'from-slate-700 via-gray-700 to-zinc-800'
                };
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${minutes} ${ampm}`;
    };

    const formatDateRange = (eventDate, endDate) => {
        if (!eventDate) return '';
        const start = parseLocalDate(eventDate);
        const end = endDate ? parseLocalDate(endDate) : null;
        const options = { month: 'short', day: 'numeric', year: 'numeric' };

        if (!end || start.getTime() === end.getTime()) {
            return start.toLocaleDateString('en-US', options);
        }
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', options)}`;
    };

    // Events that fall within or overlap with the currently selected month
    const currentMonthEvents = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

        return events.filter(e => {
            const eventStart = parseLocalDate(e.event_date);
            const eventEnd = e.end_date ? parseLocalDate(e.end_date) : eventStart;
            if (!eventStart) return false;
            const end = eventEnd || eventStart;
            return eventStart <= lastDayOfMonth && end >= firstDayOfMonth;
        });
    }, [events, currentDate]);

    const getTypeCount = (typeKey) => {
        if (typeKey === 'all') return currentMonthEvents.length;
        return currentMonthEvents.filter(e => (e.event_type || 'other').toLowerCase() === typeKey).length;
    };

    const monthEvents = useMemo(() => {
        const filtered = selectedType === 'all'
            ? currentMonthEvents
            : currentMonthEvents.filter(e => (e.event_type || 'other').toLowerCase() === selectedType);

        return filtered.sort((a, b) => parseLocalDate(a.event_date) - parseLocalDate(b.event_date));
    }, [currentMonthEvents, selectedType]);

    const visibleEvents = useMemo(() => {
        return events
            .filter(e => selectedType === 'all' || (e.event_type || 'other').toLowerCase() === selectedType)
            .sort((a, b) => parseLocalDate(a.event_date) - parseLocalDate(b.event_date));
    }, [events, selectedType]);

    const filteredDayEvents = useMemo(() => {
        if (!selectedDayInfo?.events) return [];
        if (!daySearchQuery.trim()) return selectedDayInfo.events;
        const query = daySearchQuery.toLowerCase();
        return selectedDayInfo.events.filter(e =>
            (e.title || '').toLowerCase().includes(query) ||
            (e.description || '').toLowerCase().includes(query) ||
            (e.event_type || '').toLowerCase().includes(query)
        );
    }, [selectedDayInfo, daySearchQuery]);

    const handleEventRegistration = async () => {
        if (!selectedEvent) return;
        setRegistrationSubmitting(true);
        try {
            const response = await api.post(`/events/${selectedEvent.id}/register`, {
                form_responses: registrationResponses
            });
            toast.success(response.data?.message || 'Registration confirmed');
            const updateRegistration = (event) => event.id === selectedEvent.id
                ? {
                    ...event,
                    my_registration_id: event.my_registration_id || 'registered',
                    registered_count: Number(event.registered_count || 0) + 1
                }
                : event;
            setEvents(current => current.map(updateRegistration));
            setSelectedEvent(current => current ? updateRegistration(current) : current);
            setRegistrationResponses({});
            try {
                const refreshed = await api.get('/events/student');
                const updatedEvents = refreshed.data?.data || [];
                setEvents(updatedEvents);
                setSelectedEvent(updatedEvents.find(event => event.id === selectedEvent.id) || selectedEvent);
            } catch (refreshError) {
                console.error('Failed to refresh events after registration:', refreshError);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to register for this event');
        } finally {
            setRegistrationSubmitting(false);
        }
    };

    const handleCancelRegistration = async () => {
        if (!selectedEvent || !window.confirm('Cancel your registration for this event?')) return;
        setRegistrationSubmitting(true);
        try {
            await api.delete(`/events/${selectedEvent.id}/register`);
            toast.success('Registration cancelled');
            const updateRegistration = (event) => event.id === selectedEvent.id
                ? {
                    ...event,
                    my_registration_id: null,
                    registered_count: Math.max(0, Number(event.registered_count || 0) - 1)
                }
                : event;
            setEvents(current => current.map(updateRegistration));
            setSelectedEvent(current => current ? updateRegistration(current) : current);
            try {
                const refreshed = await api.get('/events/student');
                const updatedEvents = refreshed.data?.data || [];
                setEvents(updatedEvents);
                setSelectedEvent(updatedEvents.find(event => event.id === selectedEvent.id) || selectedEvent);
            } catch (refreshError) {
                console.error('Failed to refresh events after cancellation:', refreshError);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel registration');
        } finally {
            setRegistrationSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 space-y-6 animate-fade-in text-gray-800">
            {loading ? (
                <div className="animate-pulse space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="space-y-2">
                            <SkeletonBox height="h-8" width="w-64" />
                            <SkeletonBox height="h-4" width="w-48" />
                        </div>
                        <SkeletonBox height="h-10" width="w-80" className="rounded-lg" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 h-[600px] p-4">
                            <SkeletonBox height="h-full" width="w-full" />
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-5 h-96">
                            <SkeletonBox height="h-6" width="w-32" className="mb-4" />
                            <div className="space-y-4">
                                <SkeletonBox height="h-20" width="w-full" className="rounded-lg" />
                                <SkeletonBox height="h-20" width="w-full" className="rounded-lg" />
                                <SkeletonBox height="h-20" width="w-full" className="rounded-lg" />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div>
                            <h1 className="text-lg sm:text-xl font-extrabold text-[#1e3a8a] heading-font tracking-tight">
                                Events
                            </h1>
                        </div>

                        {/* View controls and event type filter */}
                        <div className="flex flex-row items-center gap-2 w-full lg:w-auto">
                            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('cards')}
                                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-white'}`}
                                >
                                    <LayoutGrid size={14} /> Cards
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('calendar')}
                                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-white'}`}
                                >
                                    <CalendarDays size={14} /> Calendar
                                </button>
                            </div>
                            {viewMode === 'calendar' && <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 shadow-xs flex-1 sm:flex-initial justify-between">
                                <button
                                    onClick={handlePrevMonth}
                                    className="p-1.5 hover:bg-white hover:shadow-xs rounded-lg transition-all text-gray-700 active:scale-95 shrink-0"
                                    title="Previous Month"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="font-bold text-center select-none text-gray-900 text-xs md:text-sm px-1 truncate min-w-0">
                                    {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                                </span>
                                <button
                                    onClick={handleNextMonth}
                                    className="p-1.5 hover:bg-white hover:shadow-xs rounded-lg transition-all text-gray-700 active:scale-95 shrink-0"
                                    title="Next Month"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>}

                            {/* Type Dropdown strictly inline right beside Month Selector */}
                            <div className="relative flex-1 sm:w-48 min-w-0">
                                <select
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value)}
                                    className="w-full appearance-none bg-slate-100/80 border border-slate-200 text-gray-900 font-bold text-xs md:text-sm rounded-xl px-2.5 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-xs hover:bg-white truncate"
                                >
                                    {EVENT_TYPES.map(type => (
                                        <option key={type.key} value={type.key}>
                                            {type.label} ({getTypeCount(type.key)})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>




                    {viewMode === 'cards' ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {visibleEvents.map(event => {
                                const style = getEventTypeStyle(event.event_type);
                                return (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedEvent(event);
                                            setRegistrationResponses({});
                                            setShowEventModal(true);
                                        }}
                                        className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                                    >
                                        {event.image_url ? (
                                            <div className="mb-4 h-40 overflow-hidden rounded-xl">
                                                <EventPoster event={event} />
                                            </div>
                                        ) : event.event_type === 'exam' ? (
                                            <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 flex items-center justify-between">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                                                        <Award size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Exam Schedule</p>
                                                        <p className="text-xs font-semibold text-amber-900 truncate">
                                                            {event.target_branch ? `${event.target_branch} • Year ${event.target_year || ''}` : 'Examination'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 shrink-0">
                                                    Exam
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="mb-4 h-40 overflow-hidden rounded-xl">
                                                <EventPoster event={event} />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between gap-3">
                                            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${style.badge}`}>
                                                {event.event_type || 'other'}
                                            </span>
                                            <span className="text-xs font-semibold text-gray-500">
                                                {formatDateRange(event.event_date, event.end_date)}
                                            </span>
                                        </div>
                                        <h2 className="mt-3 text-base font-extrabold text-slate-900 group-hover:text-blue-700">{event.title}</h2>
                                        <p className="mt-1 min-h-[3.75rem] line-clamp-3 text-sm leading-relaxed text-slate-500">
                                            {cleanEventDescription(event.description) || 'No description provided.'}
                                        </p>
                                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1.5"><Clock size={13} />{event.start_time ? formatTime(event.start_time) : 'All day'}</span>
                                            {Boolean(event.requires_registration) && (
                                                <span className="flex items-center gap-1.5 font-semibold text-indigo-600">
                                                    {event.my_registration_id ? 'Registered' : `${event.registered_count || 0}${event.max_seats ? ` / ${event.max_seats}` : ''} registered`}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                            {visibleEvents.length === 0 && (
                                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
                                    <CalendarDays className="mx-auto mb-3 text-slate-300" size={32} />
                                    No events found.
                                </div>
                            )}
                        </div>
                    ) : (
                    /* Main Content Layout */
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                        {/* Calendar Grid Container */}
                        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden flex flex-col">
                            {/* Days Header */}
                            <div className="grid grid-cols-7 bg-slate-100/70 border-b border-slate-200">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">{d}</div>
                                ))}
                            </div>

                            {/* Date Cells */}
                            <div className="grid grid-cols-7 auto-rows-fr bg-slate-200/40 gap-[1px]">
                                {calendarDays.map((item, idx) => {
                                    const isToday = item.date === new Date().toISOString().split('T')[0];
                                    const maxVisibleEvents = 2;
                                    const hasMoreEvents = item.events && item.events.length > maxVisibleEvents;
                                    const visibleEvents = item.events ? item.events.slice(0, maxVisibleEvents) : [];

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (item.day && item.events && item.events.length > 0) {
                                                    setSelectedDayInfo({
                                                        date: item.date,
                                                        day: item.day,
                                                        events: item.events,
                                                        dateObj: item.dateObj
                                                    });
                                                    setDaySearchQuery('');
                                                    setShowDayModal(true);
                                                }
                                            }}
                                            className={`min-h-[48px] sm:min-h-[64px] md:min-h-[76px] p-1 bg-white relative transition-all duration-150 flex flex-col justify-between items-center ${!item.day
                                                    ? 'bg-slate-50/60 opacity-60 pointer-events-none'
                                                    : 'hover:bg-blue-50/30 cursor-pointer group'
                                                } ${isToday ? 'bg-blue-50/20 ring-2 ring-[#2563eb] ring-inset z-10' : ''}`}
                                        >
                                            {item.day && (
                                                <>
                                                    <div className="flex items-center justify-center w-full my-auto">
                                                        <span className={`text-[10px] sm:text-[11px] font-extrabold w-5 h-5 sm:w-5.5 sm:h-5.5 flex items-center justify-center rounded-full transition-colors ${isToday
                                                                ? 'bg-[#2563eb] text-white shadow-2xs'
                                                                : 'text-slate-800 group-hover:text-[#2563eb]'
                                                            }`}>
                                                            {item.day}
                                                        </span>
                                                    </div>

                                                    {/* Event Pills List (Max 2 visible to keep cells clean and aligned) */}
                                                    {visibleEvents.length > 0 && (
                                                        <div className="space-y-0.5 overflow-hidden w-full">
                                                            {visibleEvents.map(ev => {
                                                                const typeStyle = getEventTypeStyle(ev.event_type);
                                                                return (
                                                                    <div
                                                                        key={ev.id}
                                                                        title={`${ev.title} (${ev.event_type})`}
                                                                        className={`text-[8.5px] sm:text-[9.5px] px-1 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition-all ${typeStyle.pill}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedEvent(ev);
                                                                            setShowEventModal(true);
                                                                        }}
                                                                    >
                                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${typeStyle.bar}`}></span>
                                                                        <span className="truncate font-semibold text-gray-900 block flex-1">{ev.title}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* "+ X More" Button */}
                                                    {hasMoreEvents && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDayInfo({
                                                                    date: item.date,
                                                                    day: item.day,
                                                                    events: item.events,
                                                                    dateObj: item.dateObj
                                                                });
                                                                setDaySearchQuery('');
                                                                setShowDayModal(true);
                                                            }}
                                                            className="w-full text-[8.5px] font-bold py-0.5 px-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 transition-colors flex items-center justify-between mt-0.5"
                                                        >
                                                            <span>+{item.events.length - maxVisibleEvents} more</span>
                                                            <ArrowRightIcon size={8} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sidebar: Legend & Upcoming Events */}
                        <div className="space-y-4">

                            {/* Type Legend Summary */}
                            <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-3.5 sm:p-4">
                                <h3 className="font-bold text-gray-900 text-xs sm:text-sm mb-2.5">
                                    Event Legend
                                </h3>
                                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                    {EVENT_TYPES.filter(t => t.key !== 'all').map(t => {
                                        const style = getEventTypeStyle(t.key);
                                        const count = getTypeCount(t.key);
                                        return (
                                            <div
                                                key={t.key}
                                                onClick={() => setSelectedType(t.key)}
                                                className={`p-1.5 px-2 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all ${selectedType === t.key ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                                    }`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${style.bar}`}></span>
                                                <span className="font-semibold text-gray-800 truncate flex-1">{t.label}</span>
                                                <span className="font-bold text-[9px] text-gray-400">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Events List for Selected Month */}
                            <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-3.5 sm:p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-gray-900 text-xs sm:text-sm">
                                        Events ({currentDate.toLocaleString('default', { month: 'short' })})
                                    </h3>
                                    <span className="text-[11px] font-bold text-gray-400">({monthEvents.length})</span>
                                </div>

                                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                                    {monthEvents.map(ev => {
                                        const style = getEventTypeStyle(ev.event_type);
                                        return (
                                            <div
                                                key={ev.id}
                                                className="p-2.5 sm:p-3 rounded-lg border bg-slate-50/70 border-slate-200 hover:bg-white hover:shadow-xs hover:border-blue-200 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                                                onClick={() => {
                                                    setSelectedEvent(ev);
                                                    setShowEventModal(true);
                                                }}
                                            >
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar}`}></div>
                                                <div className="pl-2">
                                                    <div className="flex justify-between items-start gap-1.5 mb-0.5">
                                                        <h4 className="font-bold text-xs sm:text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                                                            {ev.title}
                                                        </h4>
                                                        <span className={`text-[8.5px] px-1.5 py-0.5 rounded-full uppercase font-extrabold tracking-wider border shrink-0 ${style.badge}`}>
                                                            {ev.event_type || 'other'}
                                                        </span>
                                                    </div>

                                                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                        <CalendarCheck size={12} className="text-slate-400" />
                                                        <span>{formatDateRange(ev.event_date, ev.end_date)}</span>
                                                    </div>

                                                    {ev.start_time && (
                                                        <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                            <Clock size={11} className="text-slate-400" />
                                                            <span>{formatTime(ev.start_time)} {ev.end_time ? `– ${formatTime(ev.end_time)}` : ''}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {monthEvents.length === 0 && (
                                        <div className="text-center py-6 text-gray-400 space-y-1.5">
                                            <CalendarDays size={28} className="mx-auto text-gray-300" />
                                            <p className="text-xs font-medium">No events found in {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                    )}

                    {/* DAY EVENTS OVERVIEW MODAL (Triggered when user clicks "+X more" or a day cell) */}
                    {showDayModal && selectedDayInfo && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-100 my-auto">
                                {/* Header */}
                                <div className="p-4 sm:p-6 bg-slate-900 text-white flex justify-between items-center relative overflow-hidden shrink-0">
                                    <div>
                                        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-blue-400 block mb-0.5">
                                            Events Overview
                                        </span>
                                        <h3 className="text-base sm:text-xl font-bold flex items-center gap-2">
                                            <CalendarIcon size={18} className="text-blue-400 shrink-0" />
                                            <span className="truncate">{selectedDayInfo.dateObj ? selectedDayInfo.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : selectedDayInfo.date}</span>
                                        </h3>
                                        <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">Total {selectedDayInfo.events.length} event(s) scheduled on this date.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowDayModal(false)}
                                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white z-10 shrink-0 ml-2"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Search Bar if many events */}
                                {selectedDayInfo.events.length > 3 && (
                                    <div className="p-3 border-b bg-slate-50 shrink-0">
                                        <div className="relative">
                                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search subject code, paper name, or branch..."
                                                value={daySearchQuery}
                                                onChange={(e) => setDaySearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Events List */}
                                <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                                    {filteredDayEvents.map(ev => {
                                        const style = getEventTypeStyle(ev.event_type);
                                        const isExam = String(ev.event_type || '').toLowerCase() === 'exam';
                                        const parsedExam = isExam ? parseExamTitle(ev.title) : { code: '', subject: ev.title, regulation: '' };
                                        const rawCleanDesc = cleanEventDescription(ev.description);
                                        // Hide boilerplate repetition like "Subject exam paper: ..."
                                        const meaningfulDesc = rawCleanDesc && !rawCleanDesc.toLowerCase().startsWith('subject exam paper:') && rawCleanDesc !== ev.title
                                            ? rawCleanDesc
                                            : '';

                                        return (
                                            <div
                                                key={ev.id}
                                                onClick={() => {
                                                    setSelectedEvent(ev);
                                                    setShowEventModal(true);
                                                }}
                                                className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/90 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group relative overflow-hidden"
                                            >
                                                {/* Left Accent Bar */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                                                    isExam ? 'bg-amber-500' :
                                                    ev.event_type === 'holiday' ? 'bg-rose-500' :
                                                    ev.event_type === 'academic' ? 'bg-blue-500' :
                                                    'bg-purple-500'
                                                }`} />

                                                <div className="pl-2 space-y-1.5 flex-1 min-w-0">
                                                    {/* Meta Badges Row */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-extrabold tracking-wider border ${style.badge}`}>
                                                            {ev.event_type || 'Event'}
                                                        </span>
                                                        {parsedExam.code && (
                                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-mono text-[10px] font-bold border border-amber-200 shadow-2xs">
                                                                {parsedExam.code}
                                                            </span>
                                                        )}
                                                        {ev.start_time && (
                                                            <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                                                                <Clock size={12} className="text-slate-400" />
                                                                {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Clean Title */}
                                                    <h4 className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors text-xs sm:text-sm leading-snug">
                                                        {parsedExam.subject || ev.title}
                                                    </h4>

                                                    {/* Academic & Regulation Metadata */}
                                                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 font-medium pt-0.5">
                                                        {ev.target_course && (
                                                            <span className="text-slate-700 font-bold">{ev.target_course}</span>
                                                        )}
                                                        {ev.target_branch && (
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200/60">
                                                                {ev.target_branch}
                                                            </span>
                                                        )}
                                                        {(ev.target_year || ev.target_semester) && (
                                                            <span className="text-slate-500 text-[10px]">
                                                                {ev.target_year ? `Year ${ev.target_year}` : ''}{ev.target_semester ? ` • Sem ${ev.target_semester}` : ''}
                                                            </span>
                                                        )}
                                                        {parsedExam.regulation && (
                                                            <span className="text-slate-400 text-[10px]">
                                                                ({parsedExam.regulation})
                                                            </span>
                                                        )}
                                                    </div>

                                                    {meaningfulDesc && (
                                                        <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2 mt-1">{meaningfulDesc}</p>
                                                    )}
                                                </div>

                                                {/* Action Pill */}
                                                <div className="pl-2 sm:pl-0 shrink-0 self-end sm:self-center">
                                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl transition-all shadow-2xs">
                                                        View Details
                                                        <ArrowRightIcon size={13} className="group-hover:translate-x-0.5 transition-transform" />
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredDayEvents.length === 0 && (
                                        <div className="text-center py-10">
                                            <CalendarIcon className="mx-auto mb-2 text-slate-300" size={32} />
                                            <p className="text-xs text-slate-400 font-medium">No matching events found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EVENT DETAILS MODAL */}
                    {showEventModal && selectedEvent && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in relative border border-gray-100 max-h-[85vh] flex flex-col my-auto">
                                <button
                                    onClick={() => setShowEventModal(false)}
                                    className="absolute top-3 right-3 p-1.5 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors z-20 shadow-md backdrop-blur-md cursor-pointer"
                                    title="Close"
                                >
                                    <X size={18} />
                                </button>

                                {/* Dynamic Header Based on Event Type */}
                                <div className={`p-4 sm:p-6 text-white relative overflow-hidden bg-gradient-to-br shrink-0 ${getEventTypeStyle(selectedEvent.event_type).gradient}`}>
                                    <div className="relative z-10 space-y-2 pr-6">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold backdrop-blur-md border border-white/20 uppercase tracking-wide">
                                                {selectedEvent.event_type || 'Event'}
                                            </span>
                                        </div>

                                        <h3 className="text-base sm:text-xl font-bold leading-snug break-words">{selectedEvent.title}</h3>

                                        <div className="flex items-center gap-2 text-white/90 text-xs sm:text-sm font-medium pt-0.5">
                                            <CalendarCheck size={14} />
                                            <span>{formatDateRange(selectedEvent.event_date, selectedEvent.end_date)}</span>
                                        </div>
                                    </div>

                                    {/* Ambient Glow Orbs */}
                                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-black/10 rounded-full blur-2xl pointer-events-none"></div>
                                </div>

                                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    {/* Event Media or Targeted Exam Details */}
                                    {selectedEvent.image_url ? (
                                        <div className="h-44 sm:h-52 overflow-hidden rounded-xl border border-slate-100 shadow-xs">
                                            <EventPoster event={selectedEvent} />
                                        </div>
                                    ) : selectedEvent.event_type === 'exam' ? (
                                        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
                                                    <Award size={22} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                                                            Official Exam Notification
                                                        </span>
                                                        {selectedEvent.target_college && (
                                                            <span className="text-[11px] font-bold text-amber-900 truncate">
                                                                {selectedEvent.target_college}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 text-xs text-amber-900 font-semibold flex-wrap">
                                                        {selectedEvent.target_course && (
                                                            <span className="bg-white px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                                                                Course: {selectedEvent.target_course}
                                                            </span>
                                                        )}
                                                        {selectedEvent.target_branch && (
                                                            <span className="bg-white px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                                                                Branch: {selectedEvent.target_branch}
                                                            </span>
                                                        )}
                                                        {selectedEvent.target_year && (
                                                            <span className="bg-white px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                                                                Year: {selectedEvent.target_year}
                                                            </span>
                                                        )}
                                                        {selectedEvent.target_semester && (
                                                            <span className="bg-white px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                                                                Sem: {selectedEvent.target_semester}
                                                            </span>
                                                        )}
                                                        {selectedEvent.target_batch && (
                                                            <span className="bg-white px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                                                                Batch: {selectedEvent.target_batch}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-44 overflow-hidden rounded-xl border border-slate-100 shadow-xs">
                                            <EventPoster event={selectedEvent} />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-bold">Start Time</p>
                                            <div className="flex items-center gap-1.5 text-gray-900 font-semibold text-xs sm:text-sm">
                                                <Clock size={14} className="text-blue-500" />
                                                {selectedEvent.start_time ? formatTime(selectedEvent.start_time) : 'All Day'}
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-bold">End Time</p>
                                            <div className="flex items-center gap-1.5 text-gray-900 font-semibold text-xs sm:text-sm">
                                                <Clock size={14} className="text-blue-500" />
                                                {selectedEvent.end_time ? formatTime(selectedEvent.end_time) : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                            {selectedEvent.event_type === 'exam' ? 'Exam Details & Instructions' : 'Description'}
                                        </h4>
                                        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 max-h-36 overflow-y-auto custom-scrollbar">
                                            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                                                {cleanEventDescription(selectedEvent.description) || 'No additional description provided for this event.'}
                                            </p>
                                        </div>
                                    </div>

                                    {Boolean(selectedEvent.requires_registration) && (
                                        <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                                        <Users size={16} className="text-indigo-600" /> Event Registration
                                                    </h4>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {selectedEvent.registered_count || 0}
                                                        {selectedEvent.max_seats ? ` of ${selectedEvent.max_seats} seats filled` : ' registered'}
                                                    </p>
                                                </div>
                                                {selectedEvent.registration_deadline && (
                                                    <span className="text-right text-[10px] font-semibold text-slate-500">
                                                        Deadline<br />
                                                        {new Date(selectedEvent.registration_deadline).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            {selectedEvent.my_registration_id ? (
                                                <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                                    <span className="text-xs font-semibold text-emerald-700">You are registered for this event.</span>
                                                    <button
                                                        type="button"
                                                        disabled={registrationSubmitting}
                                                        onClick={handleCancelRegistration}
                                                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                    >
                                                        {registrationSubmitting ? 'Please wait…' : 'Cancel'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {parseRegistrationFields(selectedEvent.registration_form_fields).map((field, index) => (
                                                        <label key={field.id || index} className="mt-3 block text-xs font-semibold text-slate-700">
                                                            {field.label}{field.required ? ' *' : ''}
                                                            {field.type === 'textarea' ? (
                                                                <textarea
                                                                    value={registrationResponses[field.id || field.label] || ''}
                                                                    onChange={e => setRegistrationResponses(prev => ({ ...prev, [field.id || field.label]: e.target.value }))}
                                                                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal"
                                                                    rows={3}
                                                                />
                                                            ) : (
                                                                <input
                                                                    value={registrationResponses[field.id || field.label] || ''}
                                                                    onChange={e => setRegistrationResponses(prev => ({ ...prev, [field.id || field.label]: e.target.value }))}
                                                                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal"
                                                                />
                                                            )}
                                                        </label>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        disabled={registrationSubmitting ||
                                                            (selectedEvent.max_seats && Number(selectedEvent.registered_count) >= Number(selectedEvent.max_seats)) ||
                                                            (selectedEvent.registration_deadline && new Date(selectedEvent.registration_deadline) < new Date())}
                                                        onClick={handleEventRegistration}
                                                        className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {registrationSubmitting
                                                            ? 'Please wait…'
                                                            : selectedEvent.max_seats && Number(selectedEvent.registered_count) >= Number(selectedEvent.max_seats)
                                                                ? 'Registration full'
                                                                : selectedEvent.registration_deadline && new Date(selectedEvent.registration_deadline) < new Date()
                                                                    ? 'Registration closed'
                                                                    : 'Register for Event'}
                                                    </button>
                                                </>
                                            )}
                                        </section>
                                    )}

                                    <div className="pt-3 border-t border-gray-100 flex justify-end">
                                        <button
                                            onClick={() => setShowEventModal(false)}
                                            className="px-5 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors shadow-md active:scale-95 text-xs sm:text-sm"
                                        >
                                            Close Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default StudentCalendar;
