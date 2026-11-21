import React, { useEffect, useState, useMemo } from 'react';
import { serviceService } from '../../services/serviceService';
import { toast } from 'react-hot-toast';
import {
    FileText,
    Clock,
    CheckCircle,
    AlertCircle,
    Download,
    X,
    Plus,
    Trash2,
    RefreshCw,
    Calendar,
    Search,
    Sparkles,
    CheckCircle2,
    ArrowRight
} from 'lucide-react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import api from '../../config/api';
import useAuthStore from '../../store/authStore';

const Services = () => {
    const [services, setServices] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('available'); // 'available' or 'history'
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [selectedService, setSelectedService] = useState(null);
    const [requestForm, setRequestForm] = useState({ purpose: '' });
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [servicesRes, requestsRes] = await Promise.all([
                serviceService.getAllServices(),
                serviceService.getRequests()
            ]);
            setServices(servicesRes.data || []);
            setRequests(requestsRes.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Summary statistics for dashboard-level insight
    const stats = useMemo(() => {
        const available = services.length;
        const totalReqs = requests.length;
        const ready = requests.filter(r => r.status === 'ready_to_collect').length;
        const pendingPayment = requests.filter(r => r.payment_status === 'pending').length;
        const completed = requests.filter(r => r.status === 'closed' || r.status === 'completed').length;
        return { available, totalReqs, ready, pendingPayment, completed };
    }, [services, requests]);

    // Search filtering
    const filteredServices = useMemo(() => {
        if (!searchQuery.trim()) return services;
        const q = searchQuery.toLowerCase().trim();
        return services.filter(s => {
            const name = (s.name || '').toLowerCase();
            const desc = (s.description || '').toLowerCase();
            return name.includes(q) || desc.includes(q);
        });
    }, [services, searchQuery]);

    const filteredRequests = useMemo(() => {
        if (!searchQuery.trim()) return requests;
        const q = searchQuery.toLowerCase().trim();
        return requests.filter(r => {
            const seq = (r.sequence_no || '').toLowerCase();
            const service = (r.service_name || '').toLowerCase();
            const id = String(r.id);
            return seq.includes(q) || service.includes(q) || id.includes(q);
        });
    }, [requests, searchQuery]);

    const handleRequest = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const toastId = toast.loading('Submitting request...');
            await serviceService.createRequest({
                service_id: selectedService.id,
                ...requestForm
            });
            toast.dismiss(toastId);
            toast.success('Request submitted successfully');
            setSelectedService(null);
            setRequestForm({ purpose: '' });
            setActiveTab('history');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (request) => {
        if (!window.confirm(`Are you sure you want to delete the request for ${request.service_name}?`)) return;

        try {
            const toastId = toast.loading('Deleting request...');
            await serviceService.deleteRequest(request.id);
            toast.dismiss(toastId);
            toast.success('Request deleted successfully');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Delete failed');
        }
    };

    const handleDownload = async (request) => {
        try {
            const toastId = toast.loading('Generating certificate...');

            const response = await api.get(`/services/requests/${request.id}/download`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Certificate_${request.admission_number || 'download'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);

            toast.dismiss(toastId);
            toast.success('Downloaded successfully');

        } catch (error) {
            console.error(error);
            toast.error('Download failed. Please try again.');
        }
    };

    const StatusBadge = ({ status, paymentStatus }) => {
        if (status === 'ready_to_collect') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 text-purple-600 rounded-full text-xs font-semibold border border-purple-500/20">
                    <CheckCircle2 size={12} /> Ready to Collect
                </span>
            );
        }
        if (status === 'completed' || status === 'closed') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--success-light)] text-success rounded-full text-xs font-semibold border border-success/20">
                    <CheckCircle size={12} /> Completed
                </span>
            );
        }
        if (paymentStatus === 'pending') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--warning-light)] text-warning rounded-full text-xs font-semibold border border-warning/20">
                    <AlertCircle size={12} /> Payment Pending
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background text-main rounded-full text-xs font-semibold border border-border">
                <Clock size={12} /> {status.replace(/_/g, ' ')}
            </span>
        );
    };

    return (
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-main tracking-tight">Campus Services</h1>
                    <p className="text-xs sm:text-sm text-muted-text mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        <span>Request official certificates, applications & track status in real-time</span>
                    </p>
                </div>

                {/* Segmented Tab Controls (Dashboard Style) */}
                <div className="bg-background/80 p-1 rounded-xl border border-border inline-flex items-center gap-1 self-start sm:self-auto shadow-sm">
                    <button
                        onClick={() => { setActiveTab('available'); setSearchQuery(''); }}
                        className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                            activeTab === 'available'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted-text hover:text-main hover:bg-surface'
                        }`}
                    >
                        Service Catalogs
                    </button>
                    <button
                        onClick={() => { setActiveTab('history'); setSearchQuery(''); }}
                        className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                            activeTab === 'history'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted-text hover:text-main hover:bg-surface'
                        }`}
                    >
                        <span>Active Requests</span>
                        {requests.length > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                {requests.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Dashboard Stats Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-text uppercase tracking-wider">Available</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-main font-mono mt-1">{stats.available}</h3>
                        <span className="text-[11px] text-muted-text">Active services</span>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                        <Sparkles size={20} />
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-text uppercase tracking-wider">My Requests</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-main font-mono mt-1">{stats.totalReqs}</h3>
                        <span className="text-[11px] text-amber-500 font-medium">{stats.pendingPayment} pending payment</span>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                        <Clock size={20} />
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-text uppercase tracking-wider">Ready to Collect</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-purple-600 font-mono mt-1">{stats.ready}</h3>
                        <span className="text-[11px] text-purple-600 font-medium">Ready at office</span>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                        <Calendar size={20} />
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-text uppercase tracking-wider">Completed</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-success font-mono mt-1">{stats.completed}</h3>
                        <span className="text-[11px] text-success font-medium">Delivered</span>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                        <CheckCircle2 size={20} />
                    </div>
                </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="bg-surface border border-border rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={activeTab === 'available' ? 'Search certificates & services...' : 'Search by ID or service...'}
                        className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm text-main placeholder-muted-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-main">
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="text-xs text-muted-text self-end sm:self-center font-medium">
                    Showing {activeTab === 'available' ? filteredServices.length : filteredRequests.length} item(s)
                </div>
            </div>

            {/* Tab Content: 1. Service Catalogs */}
            {activeTab === 'available' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between h-56 animate-pulse">
                                <div className="flex justify-between items-start mb-4">
                                    <SkeletonBox height="h-11" width="w-11" className="rounded-xl" />
                                    <SkeletonBox height="h-6" width="w-20" />
                                </div>
                                <div className="space-y-2">
                                    <SkeletonBox height="h-5" width="w-3/4" />
                                    <SkeletonBox height="h-4" width="w-full" />
                                </div>
                                <SkeletonBox height="h-10" width="w-full" className="rounded-xl mt-4" />
                            </div>
                        ))
                    ) : filteredServices.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-muted-text bg-surface rounded-2xl border border-dashed border-border p-8">
                            <FileText size={36} className="mx-auto text-muted-text/50 mb-3" />
                            <h3 className="font-bold text-main text-base mb-1">No services found</h3>
                            <p className="text-xs text-muted-text">Try adjusting your search query or check back later.</p>
                        </div>
                    ) : (
                        filteredServices.map(service => (
                            <div
                                key={service.id}
                                className="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold group-hover:scale-105 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                            <FileText size={22} />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl sm:text-2xl font-bold font-mono text-main tracking-tight">₹{service.price}</span>
                                            <span className="block text-[10px] font-semibold text-muted-text uppercase tracking-wider mt-0.5">Processing Fee</span>
                                        </div>
                                    </div>

                                    <h3 className="text-base sm:text-lg font-bold text-main group-hover:text-primary transition-colors line-clamp-1 mb-1.5">
                                        {service.name}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-sub line-clamp-2 leading-relaxed">
                                        {service.description || 'Request this official document through the campus service desk.'}
                                    </p>
                                </div>

                                <div className="mt-6 pt-4 border-t border-border/60">
                                    <button
                                        onClick={() => setSelectedService(service)}
                                        className="w-full py-2.5 px-4 bg-primary text-white rounded-xl hover:bg-primary-hover font-semibold text-xs sm:text-sm transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 group-hover:shadow-md"
                                    >
                                        <span>Request Service</span>
                                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Tab Content: 2. Active Requests */}
            {activeTab === 'history' && (
                <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-background/70 text-muted-text text-xs font-semibold uppercase tracking-wider border-b border-border">
                                <tr>
                                    <th className="px-5 py-3.5">Request ID</th>
                                    <th className="px-5 py-3.5">Service</th>
                                    <th className="px-5 py-3.5">Dates</th>
                                    <th className="px-5 py-3.5">Purpose / Notes</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Payment</th>
                                    <th className="px-5 py-3.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 text-sm">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-5 py-4"><SkeletonBox height="h-4" width="w-20" /></td>
                                            <td className="px-5 py-4"><SkeletonBox height="h-4" width="w-32" /></td>
                                            <td className="px-5 py-4"><SkeletonBox height="h-4" width="w-24" /></td>
                                            <td className="px-5 py-4"><SkeletonBox height="h-4" width="w-40" /></td>
                                            <td className="px-5 py-4"><SkeletonBox height="h-6" width="w-24" className="rounded-full" /></td>
                                            <td className="px-5 py-4"><SkeletonBox height="h-5" width="w-16" className="rounded-full" /></td>
                                            <td className="px-5 py-4"><SkeletonBox height="h-6" width="w-20" /></td>
                                        </tr>
                                    ))
                                ) : filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-16 text-center text-muted-text">
                                            <FileText size={36} className="mx-auto text-muted-text/50 mb-3" />
                                            <h3 className="font-bold text-main text-base mb-1">No requests found</h3>
                                            <p className="text-xs text-muted-text">Switch to "Service Catalogs" to initiate a new request.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map(req => (
                                        <tr key={req.id} className="hover:bg-background/50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-primary text-xs bg-primary/10 px-2 py-0.5 rounded-md inline-block w-fit">
                                                        {req.sequence_no || `SR-${new Date(req.request_date || Date.now()).getFullYear()}-${String(req.id).padStart(4, '0')}`}
                                                    </span>
                                                    <span className="text-[10px] text-muted-text mt-0.5">#{req.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 font-semibold text-main">{req.service_name}</td>
                                            <td className="px-5 py-4 text-xs text-muted-text">
                                                <div>Req: {new Date(req.request_date).toLocaleDateString()}</div>
                                                {req.collect_date && (
                                                    <div className="text-purple-600 font-bold mt-0.5 flex items-center gap-1">
                                                        <Calendar size={11} /> Collect: {new Date(req.collect_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-xs text-muted-text max-w-xs truncate">
                                                {(() => {
                                                    try {
                                                        const data = typeof req.request_data === 'string' ? JSON.parse(req.request_data) : req.request_data;
                                                        return data?.purpose || '-';
                                                    } catch (e) { return '-'; }
                                                })()}
                                            </td>
                                            <td className="px-5 py-4">
                                                <StatusBadge status={req.status} paymentStatus={req.payment_status} />
                                            </td>
                                            <td className="px-5 py-4">
                                                {req.payment_status === 'paid' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[var(--success-light)] text-success rounded-full text-xs font-bold uppercase border border-success/20">
                                                        Paid
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[var(--danger-light)] text-danger rounded-full text-xs font-bold uppercase border border-danger/20">
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                {req.payment_status === 'pending' ? (
                                                    <div className="flex justify-end gap-2 items-center">
                                                        <button
                                                            onClick={async () => {
                                                                const toastId = toast.loading('Checking payment status...');
                                                                try {
                                                                    const res = await serviceService.syncFeeStatus(req.id);
                                                                    if (res.syncedCount > 0) {
                                                                        toast.success(res.message, { id: toastId });
                                                                        fetchData();
                                                                    } else {
                                                                        toast(res.message, { id: toastId, icon: 'ℹ️' });
                                                                    }
                                                                } catch (e) {
                                                                    toast.error('Failed to sync fee status', { id: toastId });
                                                                }
                                                            }}
                                                            className="px-2.5 py-1 text-xs font-semibold bg-surface border border-border text-primary rounded-lg hover:bg-background flex items-center gap-1.5 transition shadow-sm"
                                                            title="Check if payment was received in Fee Portal"
                                                        >
                                                            <RefreshCw size={12} /> Sync Fee
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(req)}
                                                            className="p-1.5 text-danger hover:text-danger hover:bg-[var(--danger-light)] rounded-lg transition"
                                                            title="Delete Request"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ) : req.status === 'ready_to_collect' ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-600 rounded-lg text-xs font-bold border border-purple-500/30 shadow-sm animate-pulse">
                                                            <Calendar size={13} />
                                                            Ready to Collect {req.collect_date ? `(${new Date(req.collect_date).toLocaleDateString()})` : ''}
                                                        </span>
                                                        {req.admin_note && (
                                                            <span className="text-[11px] text-muted-text mt-1 max-w-[220px] text-right truncate" title={req.admin_note}>
                                                                {req.admin_note}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-text font-medium">In Processing</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-border/60">
                        {loading ? (
                            <div className="p-4 space-y-4 animate-pulse">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="p-4 bg-surface rounded-xl border border-border space-y-3">
                                        <div className="flex justify-between">
                                            <SkeletonBox height="h-4" width="w-1/3" />
                                            <SkeletonBox height="h-4" width="w-1/4" />
                                        </div>
                                        <SkeletonBox height="h-3" width="w-2/3" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="p-12 text-center text-muted-text text-sm">No requests found</div>
                        ) : (
                            filteredRequests.map(req => (
                                <div key={req.id} className="p-4 bg-surface hover:bg-background/50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-main text-sm">{req.service_name}</h3>
                                            <span className="font-mono text-xs text-primary font-bold">
                                                {req.sequence_no || `#${req.id}`}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-muted-text bg-background px-2 py-0.5 rounded inline-block border border-border">
                                                Req: {new Date(req.request_date).toLocaleDateString()}
                                            </span>
                                            {req.collect_date && (
                                                <div className="text-[11px] text-purple-600 font-bold mt-1 flex items-center justify-end gap-1">
                                                    <Calendar size={11} /> {new Date(req.collect_date).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-sub mb-3 line-clamp-2">
                                        {(() => {
                                            try {
                                                const data = typeof req.request_data === 'string' ? JSON.parse(req.request_data) : req.request_data;
                                                return data?.purpose || 'No purpose specified';
                                            } catch (e) { return '-'; }
                                        })()}
                                    </p>

                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/60">
                                        <div className="flex gap-2">
                                            <StatusBadge status={req.status} paymentStatus={req.payment_status} />
                                            {req.payment_status === 'paid' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-[var(--success-light)] text-success rounded-full text-[10px] font-bold uppercase border border-success/20">
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-[var(--danger-light)] text-danger rounded-full text-[10px] font-bold uppercase border border-danger/20">
                                                    Pending
                                                </span>
                                            )}
                                        </div>

                                        {req.payment_status === 'pending' ? (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleDelete(req)}
                                                    className="text-xs text-danger font-medium bg-[var(--danger-light)] px-3 py-1.5 rounded-lg hover:bg-[var(--danger-light)] transition shadow-sm flex items-center gap-1"
                                                >
                                                    <Trash2 size={12} /> Delete
                                                </button>
                                            </div>
                                        ) : req.status === 'ready_to_collect' ? (
                                            <div className="text-right">
                                                <span className="text-xs text-purple-600 font-bold bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                                    <Calendar size={12} /> Ready {req.collect_date ? `(${new Date(req.collect_date).toLocaleDateString()})` : ''}
                                                </span>
                                                {req.admin_note && (
                                                    <div className="text-[10px] text-muted-text mt-1 max-w-[160px] truncate">{req.admin_note}</div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-muted-text font-medium bg-background px-2 py-1 rounded">In Processing</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Request Modal */}
            {selectedService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-2xl w-full max-w-md p-6 shadow-2xl border border-border animate-scale-in">
                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-border">
                            <div>
                                <h2 className="text-lg font-bold text-main">{selectedService.name}</h2>
                                <p className="text-xs text-muted-text mt-0.5">Processing Fee: <strong className="text-main font-mono">₹{selectedService.price}</strong></p>
                            </div>
                            <button onClick={() => setSelectedService(null)} className="p-1.5 text-muted-text hover:text-main hover:bg-background rounded-lg transition">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleRequest} className="space-y-4">
                            {(selectedService.template_type === 'refund_application' || selectedService.name.toLowerCase().includes('refund')) ? (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-sub mb-1.5">Reason for Refund</label>
                                        <textarea
                                            required
                                            placeholder="e.g. Paid twice, Scholarship received, etc."
                                            className="w-full px-3.5 py-2.5 border border-border bg-background/50 rounded-xl focus:bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[80px] text-sm uppercase transition"
                                            style={{ textTransform: 'uppercase' }}
                                            value={requestForm.purpose}
                                            onChange={e => setRequestForm({ ...requestForm, purpose: e.target.value.toUpperCase(), reason: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-sub mb-1.5">Excess Amount (Rs.)</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. 5000"
                                                className="w-full px-3.5 py-2 border border-border bg-background/50 rounded-xl focus:bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm uppercase transition"
                                                style={{ textTransform: 'uppercase' }}
                                                value={requestForm.excess_amount || ''}
                                                onChange={e => setRequestForm({ ...requestForm, excess_amount: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-sub mb-1.5">Amount in Words</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Five Thousand Only"
                                                className="w-full px-3.5 py-2 border border-border bg-background/50 rounded-xl focus:bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm uppercase transition"
                                                style={{ textTransform: 'uppercase' }}
                                                value={requestForm.amount_in_words || ''}
                                                onChange={e => setRequestForm({ ...requestForm, amount_in_words: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <label className="block text-xs font-semibold text-sub mb-1.5">Purpose of Certificate</label>
                                    <textarea
                                        required
                                        placeholder="e.g. For Scholarship Application, Passport / Visa, Higher Studies, etc."
                                        className="w-full px-3.5 py-2.5 border border-border bg-background/50 rounded-xl focus:bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[90px] text-sm uppercase transition"
                                        style={{ textTransform: 'uppercase' }}
                                        value={requestForm.purpose}
                                        onChange={e => setRequestForm({ ...requestForm, purpose: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            )}

                            <div className="text-xs text-muted-text bg-background p-3 rounded-xl border border-border flex items-start gap-2">
                                <AlertCircle size={15} className="text-primary shrink-0 mt-0.5" />
                                <span>Note: Certificate generated will include your current academic details from the database. Please ensure your profile is up to date.</span>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all shadow-sm disabled:opacity-50 text-sm"
                                >
                                    {submitting ? 'Submitting...' : 'Confirm & Request Service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Services;