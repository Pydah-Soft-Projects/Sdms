import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Download, MapPin, Search, Ticket, Trash2, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../../config/api';

const getOptionValues = (registrations, key) => (
    [...new Set(registrations.map(registration => registration[key]).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b)))
);

const getEventTypeColor = (type) => {
    switch (String(type || '').toLowerCase()) {
        case 'workshop':
            return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'seminar':
            return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'cultural':
            return 'bg-pink-50 text-pink-700 border-pink-200';
        case 'sports':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'exam':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        default:
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
};

const getTargetSummary = (ev) => {
    if (!ev) return 'All Students';
    const parts = [];
    const parse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try {
            const p = JSON.parse(val);
            return Array.isArray(p) ? p : [p];
        } catch {
            return [val];
        }
    };
    const courses = parse(ev.target_course);
    const branches = parse(ev.target_branch);
    const years = parse(ev.target_year);
    if (courses.length) parts.push(courses.join(', '));
    if (branches.length) parts.push(branches.join(', '));
    if (years.length) parts.push(years.map(y => `Yr ${y}`).join(', '));
    return parts.length ? parts.join(' · ') : 'All Students';
};

const EventRegistrations = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ college: '', branch: '', year: '', semester: '' });

    const fetchRegistrations = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`/events/${eventId}/registrations`);
            setEvent(response.data?.data?.event || null);
            setRegistrations((response.data?.data?.registrations || [])
                .sort((a, b) => new Date(b.registered_at || 0) - new Date(a.registered_at || 0)));
        } catch (error) {
            console.error('Failed to load event registrations:', error);
            toast.error(error.response?.data?.message || 'Failed to load event registrations');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchRegistrations();
    }, [fetchRegistrations]);

    const filteredRegistrations = useMemo(() => {
        const query = search.trim().toLowerCase();
        return registrations.filter(registration => {
            const matchesFilters = (!filters.college || registration.college === filters.college) &&
                (!filters.branch || registration.branch === filters.branch) &&
                (!filters.year || String(registration.current_year || '') === filters.year) &&
                (!filters.semester || String(registration.current_semester || '') === filters.semester);
            if (!matchesFilters) return false;
            if (!query) return true;
            const searchable = [
                registration.student_name,
                registration.pin_number,
                registration.college,
                registration.branch,
                registration.current_year,
                registration.current_semester,
                registration.phone,
                registration.email,
                ...Object.values(registration.form_responses || {})
            ].join(' ').toLowerCase();
            return searchable.includes(query);
        });
    }, [registrations, filters, search]);

    const handleDeleteRegistration = async (registration) => {
        if (!window.confirm(`Remove ${registration.student_name}'s registration?`)) return;
        try {
            await api.delete(`/events/${eventId}/registrations/${registration.id}`);
            setRegistrations(current => current.filter(item => item.id !== registration.id));
            setEvent(current => current ? {
                ...current,
                registered_count: Math.max(0, Number(current.registered_count || 0) - 1)
            } : current);
            toast.success('Registration removed');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove registration');
        }
    };

    const exportRegistrations = () => {
        try {
            const rows = filteredRegistrations.map(registration => ({
                'Student Name': registration.student_name || '',
                'PIN / Roll Number': registration.pin_number || '',
                College: registration.college || '',
                Branch: registration.branch || '',
                Year: registration.current_year || '',
                Semester: registration.current_semester || '',
                Phone: registration.phone || '',
                Email: registration.email || '',
                'Registration Date': registration.registered_at
                    ? new Date(registration.registered_at).toLocaleString()
                    : '',
                'Registration Answers': Object.entries(registration.form_responses || {})
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('; ')
            }));
            const worksheet = XLSX.utils.json_to_sheet(rows);
            worksheet['!cols'] = [
                { wch: 26 }, { wch: 20 }, { wch: 28 }, { wch: 24 },
                { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 30 },
                { wch: 22 }, { wch: 60 }
            ];
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');
            const safeTitle = (event?.title || 'event').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
            XLSX.writeFile(workbook, `${safeTitle || 'event'}_registrations.xlsx`);
        } catch (error) {
            console.error('Failed to export event registrations:', error);
            toast.error('Failed to export registrations');
        }
    };

    const renderFilter = (label, key, values) => (
        <label className="min-w-0 text-xs font-semibold text-slate-600">
            {label}
            <select
                value={filters[key]}
                onChange={e => setFilters(current => ({ ...current, [key]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal"
            >
                <option value="">All {label}</option>
                {values.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
        </label>
    );

    const isExam = String(event?.event_type || '').toLowerCase() === 'exam';

    return (
        <div className="min-h-screen space-y-5 bg-gray-50/50 p-4 sm:p-6">
            {/* Top Navigation */}
            <div>
                <button
                    type="button"
                    onClick={() => navigate('/events')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 transition"
                    aria-label="Back to events"
                >
                    <ArrowLeft size={14} /> Back to Events
                </button>
            </div>

            {/* Prominent Event Details Hero Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getEventTypeColor(event?.event_type)}`}>
                                {event?.event_type || 'Event'}
                            </span>
                            {event?.registration_deadline && (
                                <span className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <Clock size={12} /> Deadline: {new Date(event.registration_deadline).toLocaleDateString()}
                                </span>
                            )}
                            {event?.is_full && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-700 uppercase tracking-wider">
                                    Seats Full
                                </span>
                            )}
                        </div>

                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                {event?.title || (loading ? 'Loading Event…' : 'Event Registrations')}
                            </h1>
                            {event?.description && (
                                <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed max-w-4xl">
                                    {event.description}
                                </p>
                            )}
                        </div>

                        {/* Event Metadata Chips */}
                        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1 text-xs text-slate-600 font-medium">
                            {event?.event_date && (
                                <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-slate-700">
                                    <Calendar size={14} className="text-indigo-600 shrink-0" />
                                    <span className="font-bold">Date:</span>
                                    {new Date(event.event_date).toLocaleDateString()}
                                    {event.end_date && event.end_date !== event.event_date ? ` – ${new Date(event.end_date).toLocaleDateString()}` : ''}
                                </span>
                            )}
                            {event?.start_time && (
                                <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-slate-700">
                                    <Clock size={14} className="text-indigo-600 shrink-0" />
                                    <span className="font-bold">Time:</span> {event.start_time}{event.end_time ? ` – ${event.end_time}` : ''}
                                </span>
                            )}
                            {event?.location && (
                                <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-slate-700">
                                    <MapPin size={14} className="text-indigo-600 shrink-0" />
                                    {event.location}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-slate-700">
                                <Users size={14} className="text-indigo-600 shrink-0" />
                                <span className="font-bold">Audience:</span> {getTargetSummary(event)}
                            </span>
                        </div>
                    </div>

                    {/* Right side: Poster (if not exam) + Metric Stats + Export */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 shrink-0">
                        {event?.image_url && !isExam && (
                            <img
                                src={event.image_url}
                                alt={event.title}
                                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border border-slate-200 shadow-xs"
                            />
                        )}
                        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                            <div className="flex-1 sm:flex-none bg-indigo-50/90 border border-indigo-100 rounded-xl px-4 py-2.5 text-center min-w-[110px]">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Registered</div>
                                <div className="text-2xl font-black text-indigo-900 mt-0.5">
                                    {event?.registered_count ?? registrations.length}
                                </div>
                            </div>
                            {event?.max_seats ? (
                                <div className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center min-w-[110px]">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Max Capacity</div>
                                    <div className="text-2xl font-black text-slate-800 mt-0.5">
                                        {event.max_seats}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={exportRegistrations}
                            disabled={loading || filteredRegistrations.length === 0}
                            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download size={16} /> Export Excel
                        </button>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <Users size={17} className="text-indigo-600" />
                        {event?.registered_count ?? registrations.length} registered
                    </div>
                    <span className="text-xs text-slate-500">{filteredRegistrations.length} shown</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="text-xs font-semibold text-slate-600 lg:col-span-1">
                        Search
                        <div className="relative mt-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Name, PIN, email…"
                                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm font-normal"
                            />
                        </div>
                    </label>
                    {renderFilter('College', 'college', getOptionValues(registrations, 'college'))}
                    {renderFilter('Branch', 'branch', getOptionValues(registrations, 'branch'))}
                    {renderFilter('Year', 'year', getOptionValues(registrations, 'current_year').map(String))}
                    {renderFilter('Semester', 'semester', getOptionValues(registrations, 'current_semester').map(String))}
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {loading ? (
                    <p className="p-8 text-center text-sm text-slate-500">Loading registrations…</p>
                ) : filteredRegistrations.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">
                        {registrations.length ? 'No registrations match your search or filters.' : 'No students have registered for this event yet.'}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Student</th>
                                    <th className="px-4 py-3 font-bold">PIN / Roll No.</th>
                                    <th className="px-4 py-3 font-bold">College</th>
                                    <th className="px-4 py-3 font-bold">Branch</th>
                                    <th className="px-4 py-3 font-bold">Year / Sem</th>
                                    <th className="px-4 py-3 font-bold">Phone</th>
                                    <th className="px-4 py-3 font-bold">Email</th>
                                    <th className="px-4 py-3 font-bold">Registered</th>
                                    <th className="px-4 py-3 text-right font-bold">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRegistrations.map(registration => (
                                    <tr key={registration.id} className="text-slate-700 hover:bg-slate-50/70">
                                        <td className="px-4 py-3 font-semibold text-slate-900">{registration.student_name || '—'}</td>
                                        <td className="px-4 py-3">{registration.pin_number || '—'}</td>
                                        <td className="px-4 py-3">{registration.college || '—'}</td>
                                        <td className="px-4 py-3">{registration.branch || '—'}</td>
                                        <td className="px-4 py-3">{[registration.current_year, registration.current_semester].filter(Boolean).join(' / ') || '—'}</td>
                                        <td className="px-4 py-3">{registration.phone || '—'}</td>
                                        <td className="px-4 py-3">{registration.email || '—'}</td>
                                        <td className="px-4 py-3">{registration.registered_at ? new Date(registration.registered_at).toLocaleDateString() : '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteRegistration(registration)}
                                                className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                                                title="Remove registration"
                                                aria-label={`Remove ${registration.student_name}'s registration`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventRegistrations;
