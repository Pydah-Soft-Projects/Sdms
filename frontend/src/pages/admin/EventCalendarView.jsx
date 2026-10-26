import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../config/api';
import EventPoster from '../../components/EventPoster';

const toDateKey = (value) => {
    if (!value) return '';
    return String(value).slice(0, 10);
};

const hasEventTargets = (event) => (
    ['target_college', 'target_batch', 'target_course', 'target_branch', 'target_year', 'target_semester']
        .some((key) => {
            const value = event[key];
            if (!value) return false;
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    return Array.isArray(parsed) ? parsed.length > 0 : Boolean(parsed);
                } catch {
                    return value.trim().length > 0;
                }
            }
            return Boolean(value);
        })
);

const EventCalendarView = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedEvent, setSelectedEvent] = useState(null);

    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            try {
                const response = await api.get('/events/admin');
                if (response.data.success) {
                    setEvents(response.data.data || []);
                } else {
                    toast.error('Failed to load calendar events');
                }
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to load calendar events');
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    const examNotifications = useMemo(
        () => events.filter((event) => String(event.event_type || '').toLowerCase() === 'exam'),
        [events]
    );
    const upcomingExams = useMemo(() => {
        const todayKey = toDateKey(new Date().toISOString());
        return [...examNotifications]
            .filter((event) => (toDateKey(event.end_date) || toDateKey(event.event_date)) >= todayKey)
            .sort((first, second) => toDateKey(first.event_date).localeCompare(toDateKey(second.event_date)));
    }, [examNotifications]);

    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells = [];
        const todayKey = toDateKey(new Date().toISOString());

        for (let index = 0; index < firstWeekday; index += 1) {
            cells.push(null);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(year, month, day);
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = examNotifications.filter((event) => {
                const startDate = toDateKey(event.event_date);
                const endDate = toDateKey(event.end_date) || startDate;
                return startDate && dateKey >= startDate && dateKey <= endDate;
            });
            cells.push({ day, dateKey, isToday: dateKey === todayKey, events: dayEvents });
        }

        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [currentMonth, examNotifications]);

    const changeMonth = (offset) => {
        setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
    };

    return (
        <div className="min-h-screen space-y-4 bg-gray-50/50 p-3 sm:p-6">
            <div className="flex justify-end">
                <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:w-auto sm:justify-start">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <h1 className="min-w-36 text-center text-sm font-bold text-gray-800">
                        {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </h1>
                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                        aria-label="Next month"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const now = new Date();
                            setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                        }}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                        Today
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label="Examination notification calendar">
                    <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="py-2 text-center text-[10px] font-semibold text-gray-500 sm:py-3 sm:text-xs">
                                {day}
                            </div>
                        ))}
                    </div>
                    {loading ? (
                        <div className="p-10 text-center text-sm text-gray-500">Loading calendar…</div>
                    ) : (
                        <div className="grid grid-cols-7">
                            {calendarDays.map((cell, index) => (
                                <div
                                    key={cell?.dateKey || `empty-${index}`}
                                    className={`min-h-20 border-b border-r border-gray-100 p-1 sm:min-h-28 sm:p-2 ${cell?.isToday ? 'bg-blue-50/60' : ''}`}
                                >
                                    {cell && (
                                        <>
                                            <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${cell.isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                                                {cell.day}
                                            </span>
                                            <div className="space-y-1">
                                                {cell.events.map((event) => (
                                                    <button
                                                        key={event.id}
                                                        type="button"
                                                        onClick={() => setSelectedEvent(event)}
                                                        className="block w-full truncate rounded border border-amber-200 bg-amber-100 px-1 py-1 text-left text-[9px] leading-tight text-amber-800 hover:bg-amber-200 sm:text-[10px]"
                                                        title={event.title}
                                                    >
                                                        {event.title}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <aside className="space-y-4">
                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <button
                            type="button"
                            onClick={() => navigate('/events')}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            <Plus size={17} /> Add Event
                        </button>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" aria-label="Upcoming examination notifications">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-800">
                            <Clock size={16} className="text-gray-500" /> Upcoming Examinations
                        </h2>
                        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                            {loading ? (
                                <p className="py-5 text-center text-sm text-gray-500">Loading examinations…</p>
                            ) : upcomingExams.length === 0 ? (
                                <p className="py-5 text-center text-sm text-gray-500">No upcoming examination notifications.</p>
                            ) : upcomingExams.map((event) => (
                                <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => setSelectedEvent(event)}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="line-clamp-2 text-xs font-semibold text-gray-800">{event.title}</span>
                                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">EXAM</span>
                                    </div>
                                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
                                        <CalendarDays size={12} />
                                        {new Date(`${toDateKey(event.event_date)}T00:00:00`).toLocaleDateString()}
                                    </p>
                                    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400">
                                        <Users size={12} />
                                        {hasEventTargets(event) ? 'Targeted' : 'All students'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>

            {selectedEvent && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-5"
                    onClick={() => setSelectedEvent(null)}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="calendar-event-title"
                        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-gray-100 p-4">
                            <h2 id="calendar-event-title" className="text-base font-bold text-gray-900">{selectedEvent.title}</h2>
                            <button
                                type="button"
                                onClick={() => setSelectedEvent(null)}
                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                                aria-label="Close event details"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4 p-4 sm:p-5">
                            <div className="h-48 overflow-hidden rounded-xl bg-gray-100">
                                <EventPoster event={selectedEvent} />
                            </div>
                            <p className="text-sm text-gray-600">
                                {new Date(selectedEvent.event_date).toLocaleDateString()}
                                {selectedEvent.end_date && toDateKey(selectedEvent.end_date) !== toDateKey(selectedEvent.event_date)
                                    ? ` – ${new Date(selectedEvent.end_date).toLocaleDateString()}`
                                    : ''}
                                {selectedEvent.start_time ? ` · ${selectedEvent.start_time}` : ''}
                            </p>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                {selectedEvent.description || 'No description provided.'}
                            </p>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default EventCalendarView;
