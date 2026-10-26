import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Search, Ticket, Trash2, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../../config/api';

const getOptionValues = (registrations, key) => (
    [...new Set(registrations.map(registration => registration[key]).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b)))
);

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

    return (
        <div className="min-h-screen space-y-5 bg-gray-50/50 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/events')}
                        className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                        aria-label="Back to events"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
                            <Ticket className="text-indigo-600" /> Event Registrations
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            {event?.title || 'Loading event…'}
                            {event?.event_date ? ` · ${new Date(event.event_date).toLocaleDateString()}` : ''}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={exportRegistrations}
                    disabled={loading || filteredRegistrations.length === 0}
                    className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
                >
                    <Download size={16} /> Export Excel
                </button>
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
