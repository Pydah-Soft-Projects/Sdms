import React, { useState, useMemo } from 'react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Ticket,
    Plus,
    Eye,
    Clock,
    CheckCircle,
    CheckCircle2,
    X,
    MessageSquare,
    Star,
    Sparkles,
    MapPin,
    Building2,
    Search,
    Filter,
    Calendar,
    ArrowUpRight,
    AlertCircle,
    RefreshCw,
    HelpCircle,
    LayoutGrid,
    List,
    Activity,
    Wrench,
    User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { resolveTicketPhotoUrl } from '../../utils/ticketPhoto';

const STATUS_CONFIG = {
    pending: {
        label: 'Pending',
        bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
        dot: 'bg-amber-500',
        borderAccent: 'border-l-amber-500',
        borderTopAccent: 'border-t-amber-500',
        countColor: 'bg-amber-100 text-amber-800'
    },
    approaching: {
        label: 'Assigned',
        bg: 'bg-sky-50 text-sky-700 border-sky-200/80',
        dot: 'bg-sky-500',
        borderAccent: 'border-l-sky-500',
        borderTopAccent: 'border-t-sky-500',
        countColor: 'bg-sky-100 text-sky-800'
    },
    resolving: {
        label: 'In Progress',
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        dot: 'bg-indigo-500',
        borderAccent: 'border-l-indigo-500',
        borderTopAccent: 'border-t-indigo-500',
        countColor: 'bg-indigo-100 text-indigo-800'
    },
    completed: {
        label: 'Resolved',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dot: 'bg-emerald-500',
        borderAccent: 'border-l-emerald-500',
        borderTopAccent: 'border-t-emerald-500',
        countColor: 'bg-emerald-100 text-emerald-800'
    },
    closed: {
        label: 'Closed',
        bg: 'bg-slate-100 text-slate-700 border-slate-200/80',
        dot: 'bg-slate-400',
        borderAccent: 'border-l-slate-400',
        borderTopAccent: 'border-t-slate-400',
        countColor: 'bg-slate-100 text-slate-600'
    }
};

const MyTickets = () => {
    const queryClient = useQueryClient();
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState({ rating: 5, feedback_text: '' });
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

    // Fetch student tickets
    const { data: ticketsData, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['student-tickets'],
        queryFn: async () => {
            const response = await api.get('/tickets/student');
            return response.data?.data || [];
        },
        staleTime: 0,
        refetchOnMount: 'always'
    });

    // Fetch ticket details
    const { data: ticketDetails } = useQuery({
        queryKey: ['ticket', selectedTicket?.id],
        queryFn: async () => {
            const response = await api.get(`/tickets/${selectedTicket.id}`);
            return response.data?.data;
        },
        enabled: !!selectedTicket
    });

    // Submit feedback mutation
    const feedbackMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.post(`/tickets/${ticketId}/feedback`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Thank you! Feedback submitted successfully.');
            setShowFeedbackModal(false);
            setFeedbackForm({ rating: 5, feedback_text: '' });
            setSelectedTicket(null);
            queryClient.invalidateQueries(['student-tickets']);
            if (selectedTicket?.id) {
                queryClient.invalidateQueries(['ticket', selectedTicket.id]);
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to submit feedback');
        }
    });

    const tickets = ticketsData || [];
    const activeTicket = ticketDetails || selectedTicket;

    const reopenMutation = useMutation({
        mutationFn: async (ticketId) => {
            const response = await api.put(`/tickets/${ticketId}/status`, {
                status: 'pending',
                notes: 'Reopened by requester (Resolution Not Satisfactory)'
            });
            return response.data;
        },
        onSuccess: () => {
            toast.success('Ticket reopened. Our team has been notified.');
            setSelectedTicket(null);
            queryClient.invalidateQueries(['student-tickets']);
            if (selectedTicket?.id) {
                queryClient.invalidateQueries(['ticket', selectedTicket.id]);
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to reopen ticket');
        }
    });

    const handleReopen = () => {
        if (!selectedTicket) return;
        if (window.confirm('Are you sure you want to reopen this ticket? The support team will re-investigate.')) {
            reopenMutation.mutate(selectedTicket.id);
        }
    };

    const handleFeedbackSubmit = () => {
        if (!feedbackForm.rating) {
            toast.error('Please select a star rating');
            return;
        }
        feedbackMutation.mutate({
            ticketId: selectedTicket.id,
            data: feedbackForm
        });
    };

    // Extract dynamic unique categories for filtering
    const categories = useMemo(() => {
        const set = new Set();
        tickets.forEach((t) => {
            if (t.category_name) set.add(t.category_name);
        });
        return Array.from(set);
    }, [tickets]);

    // Filter tickets based on status, search, and category
    const filteredTickets = useMemo(() => {
        return tickets.filter((t) => {
            const matchesTab =
                activeTab === 'all'
                    ? true
                    : activeTab === 'pending'
                    ? t.status === 'pending'
                    : activeTab === 'in_progress'
                    ? t.status === 'approaching' || t.status === 'resolving'
                    : activeTab === 'completed'
                    ? t.status === 'completed' || t.status === 'closed'
                    : true;

            const matchesCategory =
                selectedCategory === 'all' || t.category_name === selectedCategory;

            const q = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !q ||
                t.title?.toLowerCase().includes(q) ||
                t.ticket_number?.toLowerCase().includes(q) ||
                t.category_name?.toLowerCase().includes(q) ||
                t.sub_category_name?.toLowerCase().includes(q) ||
                t.college_name?.toLowerCase().includes(q) ||
                t.block_no?.toLowerCase().includes(q) ||
                t.room_no?.toLowerCase().includes(q);

            return matchesTab && matchesCategory && matchesSearch;
        });
    }, [tickets, activeTab, selectedCategory, searchQuery]);

    const counts = useMemo(() => {
        return {
            all: tickets.length,
            pending: tickets.filter((t) => t.status === 'pending').length,
            in_progress: tickets.filter((t) => t.status === 'approaching' || t.status === 'resolving').length,
            completed: tickets.filter((t) => t.status === 'completed' || t.status === 'closed').length
        };
    }, [tickets]);

    if (isLoading) {
        return (
            <div className="w-full space-y-4 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200/80 border-t-4 border-t-slate-300 shadow-xs space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <SkeletonBox height="h-5" width="w-24" rounded="rounded-md" />
                                    <SkeletonBox height="h-5" width="w-20" rounded="rounded-full" />
                                </div>
                                <SkeletonBox height="h-4" width="w-32" rounded="rounded-md" />
                                <SkeletonBox height="h-6" width="w-3/4" rounded="rounded-md" />
                                <SkeletonBox height="h-4" width="w-full" rounded="rounded-md" />
                                <SkeletonBox height="h-4" width="w-2/3" rounded="rounded-md" />
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex gap-2">
                                <SkeletonBox height="h-9" width="w-full" rounded="rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4 font-sans text-left">

            {/* Filter Toolbar & Actions */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs space-y-3">
                {/* Top Row: Status Tabs & Raise Ticket CTA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        {[
                            { id: 'all', label: 'All Tickets', count: counts.all, icon: Ticket },
                            { id: 'pending', label: 'Pending', count: counts.pending, icon: Clock, countColor: 'bg-amber-100 text-amber-800' },
                            { id: 'in_progress', label: 'In Progress', count: counts.in_progress, icon: Activity, countColor: 'bg-indigo-100 text-indigo-800' },
                            { id: 'completed', label: 'Resolved', count: counts.completed, icon: CheckCircle2, countColor: 'bg-emerald-100 text-emerald-800' }
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                                        isActive
                                            ? 'bg-sky-50 text-sky-700 border border-sky-200/80 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                                    }`}
                                >
                                    <Icon size={15} className={isActive ? 'text-sky-600' : 'text-slate-400'} />
                                    <span>{tab.label}</span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                            isActive
                                                ? 'bg-sky-200/70 text-sky-800'
                                                : (tab.countColor || 'bg-slate-100 text-slate-600')
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Primary Raise Ticket Button */}
                    <Link
                        to="/student/raise-ticket"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs hover:shadow transition-all whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                        <Plus size={16} />
                        <span>Raise Ticket</span>
                    </Link>
                </div>

                {/* Bottom Row: Search, Category Filter, View Mode Switcher & Refresh */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[240px]">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[200px] max-w-md">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tickets, IDs, rooms..."
                                className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl outline-none text-slate-800 placeholder-slate-400 transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Category Dropdown Filter */}
                        {categories.length > 0 && (
                            <div className="relative">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="pl-3 pr-8 py-1.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl outline-none text-slate-700 font-medium transition-colors cursor-pointer appearance-none"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <Filter size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        )}
                    </div>

                    {/* View Switcher & Refresh */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
                            <button
                                type="button"
                                onClick={() => setViewMode('cards')}
                                title="Grid Cards View"
                                className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    viewMode === 'cards'
                                        ? 'bg-white text-sky-700 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <LayoutGrid size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('table')}
                                title="Table View"
                                className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    viewMode === 'table'
                                        ? 'bg-white text-sky-700 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <List size={15} />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            title="Refresh tickets"
                            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs shrink-0 cursor-pointer"
                        >
                            <RefreshCw size={15} className={isFetching ? 'animate-spin text-sky-600' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Ticket Content: Cards View or Table View */}
            <AnimatePresence mode="wait">
                {filteredTickets.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-500 mx-auto flex items-center justify-center mb-4">
                            <Ticket size={28} />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">
                            {searchQuery || selectedCategory !== 'all' ? 'No matching tickets found' : 'No tickets in this section'}
                        </h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                            {searchQuery || selectedCategory !== 'all'
                                ? 'Try clearing your search filters or switching to another category.'
                                : 'You currently do not have any requests under this section. Need help with maintenance or support?'}
                        </p>
                        {searchQuery || selectedCategory !== 'all' ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedCategory('all');
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                <RefreshCw size={14} /> Clear Filters
                            </button>
                        ) : (
                            <Link
                                to="/student/raise-ticket"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-sm shadow-sm hover:shadow transition-all"
                            >
                                <Plus size={18} />
                                <span>Create a Ticket</span>
                            </Link>
                        )}
                    </motion.div>
                ) : viewMode === 'table' ? (
                    /* Responsive Table View */
                    <motion.div
                        key="table-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-3.5 px-4 font-semibold">Ref #</th>
                                        <th className="py-3.5 px-4 font-semibold">Issue & Category</th>
                                        <th className="py-3.5 px-4 font-semibold">Location</th>
                                        <th className="py-3.5 px-4 font-semibold">Status</th>
                                        <th className="py-3.5 px-4 font-semibold">Date</th>
                                        <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                                    {filteredTickets.map((t) => {
                                        const isFeedbackGiven = t.feedback && t.feedback.id;
                                        const effectiveStatus = isFeedbackGiven ? 'closed' : t.status;
                                        const statusInfo = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;

                                        return (
                                            <tr
                                                key={t.id}
                                                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                                onClick={() => setSelectedTicket(t)}
                                            >
                                                <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                                                    #{t.ticket_number || t.id}
                                                </td>
                                                <td className="py-3 px-4 max-w-md">
                                                    <div className="font-semibold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1">
                                                        {t.title}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                        <span className="font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                                                            {t.category_name}
                                                        </span>
                                                        {t.sub_category_name && (
                                                            <span>› {t.sub_category_name}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                                                        {t.college_name && (
                                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                                                {t.college_name}
                                                            </span>
                                                        )}
                                                        {t.block_no && (
                                                            <span className="bg-sky-50 px-1.5 py-0.5 rounded text-sky-700">
                                                                B: {t.block_no}
                                                            </span>
                                                        )}
                                                        {t.room_no && (
                                                            <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">
                                                                R: {t.room_no}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg}`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                                                    {new Date(t.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedTicket(t)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                                        >
                                                            <Eye size={13} />
                                                            <span>Details</span>
                                                        </button>
                                                        {t.status === 'completed' && !isFeedbackGiven && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedTicket(t);
                                                                    setShowFeedbackModal(true);
                                                                }}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                                                            >
                                                                <Star size={13} />
                                                                <span>Rate</span>
                                                            </button>
                                                        )}
                                                        {isFeedbackGiven && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                                                <CheckCircle size={13} />
                                                                <span>{t.feedback.rating}★</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                ) : (
                    /* Responsive Card Grid (Cards Type) */
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-stretch">
                        {filteredTickets.map((t, index) => {
                            const isFeedbackGiven = t.feedback && t.feedback.id;
                            const effectiveStatus = isFeedbackGiven ? 'closed' : t.status;
                            const statusInfo = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;

                            return (
                                <motion.div
                                    key={t.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.025 }}
                                    className={`group bg-white hover:bg-slate-50/30 rounded-2xl border border-slate-200/80 hover:border-sky-300 border-t-4 ${statusInfo.borderTopAccent || 'border-t-sky-500'} shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden text-left`}
                                >
                                    {/* Card Main Body */}
                                    <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-3">
                                        {/* Top Meta: Ref ID & Status Badge */}
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200/80">
                                                #{t.ticket_number || t.id}
                                            </span>

                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg}`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                                                {statusInfo.label}
                                            </span>
                                        </div>

                                        {/* Category & Date Sub-header */}
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                            <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 truncate max-w-[180px]">
                                                {t.category_name}
                                                {t.sub_category_name && (
                                                    <span className="font-normal text-sky-600"> › {t.sub_category_name}</span>
                                                )}
                                            </span>

                                            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                                                {new Date(t.created_at).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>

                                        {/* Title & Description */}
                                        <div className="space-y-1 pt-0.5 flex-1">
                                            <h3
                                                onClick={() => setSelectedTicket(t)}
                                                className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors cursor-pointer line-clamp-2 leading-snug"
                                                title={t.title}
                                            >
                                                {t.title}
                                            </h3>

                                            {t.description && (
                                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                    {t.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Location Chips */}
                                        {(t.college_name || t.block_no || t.floor_no || t.room_no || t.assigned_to_name) && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                                                {t.college_name && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium truncate max-w-full">
                                                        <Building2 size={11} className="text-slate-400 shrink-0" />
                                                        <span className="truncate">{t.college_name}</span>
                                                    </span>
                                                )}
                                                {t.block_no && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-medium">
                                                        <MapPin size={11} className="text-sky-400" />
                                                        B: {t.block_no}
                                                    </span>
                                                )}
                                                {t.floor_no && (
                                                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                                                        F: {t.floor_no}
                                                    </span>
                                                )}
                                                {t.room_no && (
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                                                        R: {t.room_no}
                                                    </span>
                                                )}
                                                {t.assigned_to_name && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 font-medium">
                                                        <Wrench size={11} className="text-purple-400" />
                                                        {t.assigned_to_name}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTicket(t)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
                                        >
                                            <Eye size={13} />
                                            <span>Details</span>
                                        </button>

                                        {/* Rate Resolution Button if completed and no feedback */}
                                        {t.status === 'completed' && !isFeedbackGiven && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedTicket(t);
                                                    setShowFeedbackModal(true);
                                                }}
                                                className="inline-flex items-center gap-1 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                                            >
                                                <Star size={13} />
                                                <span>Rate</span>
                                            </button>
                                        )}

                                        {/* Already Reviewed Badge */}
                                        {isFeedbackGiven && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                                <CheckCircle size={13} />
                                                <span>{t.feedback.rating}★</span>
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </AnimatePresence>

            {/* Ticket Details Modal */}
            {selectedTicket && !showFeedbackModal && (
                <TicketDetailsModal
                    ticket={activeTicket}
                    onClose={() => setSelectedTicket(null)}
                    onFeedback={() => setShowFeedbackModal(true)}
                    onReopen={handleReopen}
                />
            )}

            {/* Feedback Modal */}
            {showFeedbackModal && selectedTicket && (
                <FeedbackModal
                    ticket={selectedTicket}
                    form={feedbackForm}
                    setForm={setFeedbackForm}
                    onClose={() => {
                        setShowFeedbackModal(false);
                        setSelectedTicket(null);
                    }}
                    onSubmit={handleFeedbackSubmit}
                    loading={feedbackMutation.isPending}
                />
            )}
        </div>
    );
};

// Stepper Component inside Modal
const TicketStepper = ({ status }) => {
    const steps = [
        { label: 'Submitted', value: 'pending' },
        { label: 'Assigned', value: 'approaching' },
        { label: 'In Progress', value: 'resolving' },
        { label: 'Resolved', value: 'completed' }
    ];

    const currentStepIndex =
        steps.findIndex((s) => s.value === status) === -1
            ? status === 'closed'
                ? 3
                : 0
            : steps.findIndex((s) => s.value === status);

    return (
        <div className="relative my-6 px-4">
            {/* Background line */}
            <div className="absolute top-4 left-8 right-8 h-0.5 bg-slate-200 -z-0" />
            {/* Active line */}
            <div
                className="absolute top-4 left-8 h-0.5 bg-sky-500 transition-all duration-500 -z-0"
                style={{
                    width: `calc(${(currentStepIndex / (steps.length - 1)) * 100}% - 4rem)`
                }}
            />

            <div className="flex justify-between items-center relative z-10">
                {steps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                        <div key={index} className="flex flex-col items-center gap-1.5 flex-1">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                                    isCompleted
                                        ? 'bg-sky-500 text-white shadow-xs'
                                        : 'bg-white border-2 border-slate-300 text-slate-400'
                                } ${isCurrent ? 'ring-4 ring-sky-100' : ''}`}
                            >
                                {isCompleted ? <CheckCircle size={15} /> : index + 1}
                            </div>
                            <span
                                className={`text-[11px] sm:text-xs font-medium text-center ${
                                    isCompleted ? 'text-slate-800' : 'text-slate-400'
                                }`}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Ticket Details Modal
const TicketDetailsModal = ({ ticket, onClose, onFeedback, onReopen }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans">
            <div className="absolute inset-0" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="relative bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col z-10"
            >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-slate-800">Ticket Details</h2>
                            <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-sky-600">
                                #{ticket.ticket_number || ticket.id}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Created on {new Date(ticket.created_at).toLocaleString()}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Stepper */}
                    <TicketStepper status={ticket.status} />

                    {/* Subject & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                                Category & Subcategory
                            </span>
                            <p className="text-sm font-semibold text-slate-800">
                                {ticket.category_name}
                                {ticket.sub_category_name && (
                                    <span className="text-sky-600 font-medium"> › {ticket.sub_category_name}</span>
                                )}
                            </p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                                Current Status
                            </span>
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                    STATUS_CONFIG[ticket.status]?.bg || STATUS_CONFIG.pending.bg
                                }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        STATUS_CONFIG[ticket.status]?.dot || STATUS_CONFIG.pending.dot
                                    }`}
                                />
                                {STATUS_CONFIG[ticket.status]?.label || ticket.status}
                            </span>
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                            Subject
                        </span>
                        <h3 className="text-base font-semibold text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200/80">
                            {ticket.title}
                        </h3>
                    </div>

                    {/* Physical Location */}
                    {(ticket.college_name || ticket.block_no || ticket.floor_no || ticket.room_no) && (
                        <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 uppercase tracking-wider mb-2.5">
                                <MapPin size={14} className="text-sky-500" />
                                <span>Physical Location</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                {ticket.college_name && (
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Campus</span>
                                        <span className="font-semibold text-slate-800">{ticket.college_name}</span>
                                    </div>
                                )}
                                {ticket.block_no && (
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Block</span>
                                        <span className="font-semibold text-slate-800">{ticket.block_no}</span>
                                    </div>
                                )}
                                {ticket.floor_no && (
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Floor</span>
                                        <span className="font-semibold text-slate-800">{ticket.floor_no}</span>
                                    </div>
                                )}
                                {ticket.room_no && (
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Room</span>
                                        <span className="font-semibold text-slate-800">{ticket.room_no}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                            Detailed Description
                        </span>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {ticket.description || 'No description provided.'}
                        </div>
                    </div>

                    {/* Evidence Attachment */}
                    {(ticket.photo_url || ticket.has_photo) && (
                        <div>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1.5">
                                Attachment
                            </span>
                            <div className="rounded-xl overflow-hidden border border-slate-200 max-h-56 bg-slate-100">
                                <img
                                    src={resolveTicketPhotoUrl(ticket.photo_url)}
                                    alt="Evidence"
                                    className="w-full h-56 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                    onClick={() => window.open(resolveTicketPhotoUrl(ticket.photo_url), '_blank')}
                                />
                            </div>
                        </div>
                    )}

                    {/* Feedback details if existing */}
                    {ticket.feedback && (
                        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                                    <MessageSquare size={14} />
                                    <span>Requester Feedback</span>
                                </div>
                                <div className="flex items-center gap-1 text-amber-500">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            size={16}
                                            fill={star <= ticket.feedback.rating ? 'currentColor' : 'none'}
                                        />
                                    ))}
                                    <span className="text-xs font-semibold text-emerald-900 ml-1">
                                        {ticket.feedback.rating}/5
                                    </span>
                                </div>
                            </div>
                            {ticket.feedback.feedback_text && (
                                <p className="text-xs text-emerald-900 leading-relaxed">
                                    "{ticket.feedback.feedback_text}"
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                    {ticket.status === 'completed' && !ticket.feedback && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="text-xs font-medium text-slate-600">Satisfied with the fix?</span>
                            <button
                                onClick={onReopen}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                            >
                                Not Satisfied (Reopen)
                            </button>
                            <button
                                onClick={onFeedback}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                            >
                                Satisfied (Rate)
                            </button>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="ml-auto px-4 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-100 transition-colors shadow-xs"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// Feedback Modal
const FeedbackModal = ({ ticket, form, setForm, onClose, onSubmit, loading }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans">
            <div className="absolute inset-0" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="relative bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md p-6 z-10 space-y-5"
            >
                <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                        <CheckCircle size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">Rate Resolution</h3>
                    <p className="text-xs text-slate-500">
                        How was your support experience for ticket #{ticket.ticket_number || ticket.id}?
                    </p>
                </div>

                {/* Star rating */}
                <div className="flex justify-center items-center gap-2 py-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                            key={rating}
                            type="button"
                            onClick={() => setForm({ ...form, rating })}
                            className="p-1 hover:scale-110 transition-transform"
                        >
                            <Star
                                size={32}
                                className={form.rating >= rating ? 'text-amber-400' : 'text-slate-200'}
                                fill={form.rating >= rating ? 'currentColor' : 'none'}
                            />
                        </button>
                    ))}
                </div>

                {/* Feedback comment */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                        Comments or feedback <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                        rows={3}
                        value={form.feedback_text}
                        onChange={(e) => setForm({ ...form, feedback_text: e.target.value })}
                        placeholder="Tell us what went well or what could be improved..."
                        className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 outline-none focus:border-sky-500 bg-slate-50/70 focus:bg-white transition-colors resize-none"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200/80 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={loading || !form.rating}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all disabled:opacity-50"
                    >
                        {loading ? 'Submitting...' : 'Submit Rating'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default MyTickets;
