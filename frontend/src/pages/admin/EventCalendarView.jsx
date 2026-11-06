import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../config/api';

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
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedDateEvents, setSelectedDateEvents] = useState(null);

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
        <div className="min-h-screen space-y-4 bg-[var(--background)]/50 p-3 sm:p-6">
            <div className="flex justify-end">
                <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface p-2 shadow-sm sm:w-auto sm:justify-start">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        className="rounded-lg p-2 text-sub hover:bg-background"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <h1 className="min-w-36 text-center text-sm font-bold text-main">
                        {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </h1>
                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        className="rounded-lg p-2 text-sub hover:bg-background"
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
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-[var(--primary-light)]"
                    >
                        Today
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
                <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm" aria-label="Examination notification calendar">
                    <div className="grid grid-cols-7 border-b border-border bg-background">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="py-2 text-center text-[10px] font-semibold text-muted-text sm:py-3 sm:text-xs">
                                {day}
                            </div>
                        ))}
                    </div>
                    {loading ? (
                        <div className="p-10 text-center text-sm text-muted-text">Loading calendar…</div>
                    ) : (
                        <div className="grid grid-cols-7">
                            {calendarDays.map((cell, index) => (
                                <div
                                    key={cell?.dateKey || `empty-${index}`}
                                    onClick={() => {
                                        if (cell?.events?.length) {
                                            setSelectedDateEvents(cell);
                                        }
                                    }}
                                    className={`h-28 sm:h-36 border-b border-r border-border p-1 sm:p-1.5 flex flex-col overflow-hidden transition-colors ${
                                        cell?.isToday ? 'bg-[var(--primary-light)]' : cell ? 'bg-surface' : 'bg-[var(--background)]/40'
                                    } ${cell?.events?.length ? 'cursor-pointer hover:bg-[var(--warning-light)]' : ''}`}
                                >
                                    {cell && (
                                        <>
                                            <div className="flex items-center justify-between shrink-0 mb-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (cell.events.length) {
                                                            setSelectedDateEvents(cell);
                                                        }
                                                    }}
                                                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-all ${
                                                        cell.isToday
                                                            ? 'bg-primary text-white font-bold shadow-xs'
                                                            : cell.events.length > 0
                                                            ? 'text-main font-bold hover:bg-[var(--primary-light)] hover:text-primary'
                                                            : 'text-sub'
                                                    }`}
                                                    title={cell.events.length > 0 ? `Click to view all ${cell.events.length} notifications` : undefined}
                                                >
                                                    {cell.day}
                                                </button>
                                                {cell.events.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDateEvents(cell);
                                                        }}
                                                        className="text-[10px] font-bold text-warning bg-[var(--warning-light)] hover:bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-md px-1.5 py-0.5 transition"
                                                        title={`View all ${cell.events.length} notifications`}
                                                    >
                                                        {cell.events.length}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar min-h-0 [scrollbar-width:thin]">
                                                {cell.events.map((event) => (
                                                    <button
                                                        key={event.id}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedEvent(event);
                                                        }}
                                                        className="block w-full truncate rounded border border-[var(--warning-light)] bg-[var(--warning-light)] px-1 py-1 text-left text-[9px] leading-tight text-warning hover:bg-[var(--warning-light)] sm:text-[10px] shrink-0"
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
                    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm" aria-label="Upcoming examination notifications">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-main">
                            <Clock size={16} className="text-muted-text" /> Upcoming Examinations
                        </h2>
                        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                            {loading ? (
                                <p className="py-5 text-center text-sm text-muted-text">Loading examinations…</p>
                            ) : upcomingExams.length === 0 ? (
                                <p className="py-5 text-center text-sm text-muted-text">No upcoming examination notifications.</p>
                            ) : upcomingExams.map((event) => (
                                <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => setSelectedEvent(event)}
                                    className="w-full rounded-xl border border-border bg-background p-3 text-left transition hover:border-[var(--primary-light)] hover:bg-[var(--primary-light)]"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="line-clamp-2 text-xs font-semibold text-main">{event.title}</span>
                                        <span className="shrink-0 rounded bg-[var(--warning-light)] px-1.5 py-0.5 text-[9px] font-bold text-warning">EXAM</span>
                                    </div>
                                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-text">
                                        <CalendarDays size={12} />
                                        {new Date(`${toDateKey(event.event_date)}T00:00:00`).toLocaleDateString()}
                                    </p>
                                    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-text">
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
                        className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-border p-4">
                            <h2 id="calendar-event-title" className="text-base font-bold text-main">{selectedEvent.title}</h2>
                            <button
                                type="button"
                                onClick={() => setSelectedEvent(null)}
                                className="rounded-lg p-2 text-muted-text hover:bg-background"
                                aria-label="Close event details"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4 p-4 sm:p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-[var(--warning-light)] px-2 py-0.5 text-xs font-bold text-warning">
                                    EXAMINATION NOTIFICATION
                                </span>
                                <span className="text-xs font-semibold text-muted-text flex items-center gap-1">
                                    <CalendarDays size={13} className="text-primary" />
                                    {new Date(selectedEvent.event_date).toLocaleDateString()}
                                    {selectedEvent.end_date && toDateKey(selectedEvent.end_date) !== toDateKey(selectedEvent.event_date)
                                        ? ` – ${new Date(selectedEvent.end_date).toLocaleDateString()}`
                                        : ''}
                                    {selectedEvent.start_time ? ` · ${selectedEvent.start_time}` : ''}
                                </span>
                            </div>
                            <div className="rounded-xl border border-border bg-[var(--background)]/80 p-4">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-sub">
                                    {selectedEvent.description || 'No description provided.'}
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {/* Day All Notifications Popup */}
            {selectedDateEvents && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-5 animate-fade-in"
                    onClick={() => setSelectedDateEvents(null)}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="day-notifications-title"
                        className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-[var(--background)]/80">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-base shadow-xs">
                                    {selectedDateEvents.day}
                                </div>
                                <div>
                                    <h2 id="day-notifications-title" className="text-base sm:text-lg font-bold text-main">
                                        {new Date(`${selectedDateEvents.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </h2>
                                    <p className="text-xs text-muted-text font-medium">
                                        {selectedDateEvents.events.length} {selectedDateEvents.events.length === 1 ? 'examination notification' : 'examination notifications'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDateEvents(null)}
                                className="rounded-lg p-2 text-muted-text hover:bg-[var(--background)]/70 hover:text-main transition"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* List of all notifications for this date */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar">
                            {selectedDateEvents.events.map((event, idx) => (
                                <div
                                    key={event.id || idx}
                                    className="rounded-xl border border-[var(--warning-light)] bg-[var(--warning-light)] p-4 space-y-2.5 hover:bg-[var(--warning-light)] transition shadow-2xs"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <h3 className="text-sm sm:text-base font-bold text-main leading-snug">
                                            {event.title}
                                        </h3>
                                        <span className="shrink-0 rounded bg-[var(--warning-light)] border border-[var(--warning-light)] px-2 py-0.5 text-[10px] font-bold text-warning uppercase tracking-wide">
                                            EXAM
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-text font-medium pt-0.5">
                                        <span className="flex items-center gap-1 text-sub">
                                            <CalendarDays size={13} className="text-primary" />
                                            {new Date(event.event_date).toLocaleDateString()}
                                            {event.end_date && toDateKey(event.end_date) !== toDateKey(event.event_date)
                                                ? ` – ${new Date(event.end_date).toLocaleDateString()}`
                                                : ''}
                                        </span>
                                        {event.start_time && (
                                            <span className="flex items-center gap-1 text-sub">
                                                <Clock size={13} className="text-primary" />
                                                {event.start_time}{event.end_time ? ` – ${event.end_time}` : ''}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 text-muted-text">
                                            <Users size={13} className="text-muted-text" />
                                            {hasEventTargets(event) ? 'Targeted Students' : 'All Students'}
                                        </span>
                                    </div>

                                    {event.description && (
                                        <div className="rounded-lg bg-[var(--surface)]/90 border border-[var(--warning-light)] p-3 mt-1.5">
                                            <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-sub">
                                                {event.description}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-border px-5 py-3 bg-[var(--background)]/70 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedDateEvents(null)}
                                className="px-4 py-2 rounded-xl bg-background hover:bg-background text-sub text-xs font-bold transition"
                            >
                                Close
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default EventCalendarView;
