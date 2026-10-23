import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Ticket,
    Clock,
    CheckCircle2,
    Plus,
    ArrowRight,
    Activity,
    ShieldCheck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { StudentDashboardSkeleton } from '../../components/SkeletonLoader';
import '../../styles/student-pages.css';

const Dashboard = () => {
    const navigate = useNavigate();

    // Fetch tickets data for summary
    const { data: tickets = [], isLoading } = useQuery({
        queryKey: ['tickets'],
        queryFn: async () => {
            const response = await api.get('/tickets/student');
            return response.data?.data || [];
        }
    });

    const stats = React.useMemo(() => ({
        total: tickets.length,
        pending: tickets.filter(t => t.status === 'pending').length,
        resolved: tickets.filter(t => ['completed', 'closed'].includes(t.status)).length,
        active: tickets.filter(t => ['approaching', 'resolving'].includes(t.status)).length
    }), [tickets]);

    if (isLoading) {
        return <StudentDashboardSkeleton />;
    }

    return (
        <div className="space-y-6 pb-6 font-sans">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                    { label: 'Total Tickets', value: stats.total, icon: Ticket, bg: 'bg-sky-50 text-sky-600 border-sky-100' },
                    { label: 'Pending', value: stats.pending, icon: Clock, bg: 'bg-amber-50 text-amber-600 border-amber-100' },
                    { label: 'In Progress', value: stats.active, icon: Activity, bg: 'bg-purple-50 text-purple-600 border-purple-100' },
                    { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' }
                ].map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={idx}
                            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-sm transition-all"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {stat.label}
                                </span>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${stat.bg}`}>
                                    <Icon size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 tracking-tight">
                                {stat.value}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Recent Activity */}
                <div className="lg:col-span-8 space-y-3">
                    <div className="flex items-center justify-between px-0.5">
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            Recent Tickets
                        </h2>
                        <Link
                            to="/student/my-tickets"
                            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                        >
                            <span>View All</span>
                            <ArrowRight size={13} />
                        </Link>
                    </div>

                    {tickets.length > 0 ? (
                        <div className="space-y-2.5">
                            {tickets.slice(0, 4).map((ticket) => (
                                <div
                                    key={ticket.id}
                                    onClick={() => navigate('/student/my-tickets')}
                                    className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs hover:border-sky-300 hover:shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                                            <Ticket size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-slate-900 truncate">
                                                {ticket.title}
                                            </h4>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                #{ticket.ticket_number} • {new Date(ticket.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="shrink-0">
                                        <span className={`status-badge ${
                                            ['completed', 'closed'].includes(ticket.status)
                                                ? 'status-completed'
                                                : ['approaching', 'resolving'].includes(ticket.status)
                                                    ? 'status-active'
                                                    : 'status-pending'
                                        }`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
                                <ShieldCheck size={24} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800">No tickets raised yet</h3>
                            <p className="text-xs text-slate-500 mt-1 mb-4 max-w-xs mx-auto">
                                All your infrastructure, maintenance, and support requests will be listed here.
                            </p>
                            <Link
                                to="/student/raise-ticket"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-2xs"
                            >
                                <Plus size={15} />
                                <span>Raise First Ticket</span>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="lg:col-span-4 space-y-3">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider px-0.5">
                        Quick Actions
                    </h2>
                    <div className="space-y-3">
                        <Link
                            to="/student/raise-ticket"
                            className="block p-4 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-sm shadow-sky-500/20 hover:shadow-md hover:scale-[1.01] transition-all"
                        >
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-2.5">
                                <Plus size={18} />
                            </div>
                            <h3 className="text-sm font-bold tracking-tight">Raise a Ticket</h3>
                            <p className="text-xs text-sky-100/90 mt-1 leading-relaxed">
                                Need help with equipment, classrooms, or services? Submit an issue immediately.
                            </p>
                        </Link>

                        <Link
                            to="/student/my-tickets"
                            className="block p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-sky-300 hover:shadow-sm hover:scale-[1.01] transition-all"
                        >
                            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mb-2.5 border border-sky-100">
                                <Ticket size={18} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 tracking-tight">My Raised Tickets</h3>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Check resolution status, engineer feedback, and history of all your tickets.
                            </p>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
