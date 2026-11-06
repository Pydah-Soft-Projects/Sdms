import React, { useState } from 'react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ticket,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Star,
  RefreshCw,
  Sparkles,
  X,
  MapPin,
  Building2,
  Upload,
  Image as ImageIcon,
  Check,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';
import { maintenanceApiUrl, maintenanceFileUrl } from '../../config/maintenanceApi';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approaching: 'bg-blue-50 text-blue-800 border-blue-200',
  resolving: 'bg-purple-50 text-purple-800 border-purple-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  closed: 'bg-slate-100 text-slate-800 border-slate-200'
};

const STATUS_LABELS = {
  pending: 'Pending',
  approaching: 'Approaching',
  resolving: 'Resolving',
  completed: 'Completed',
  closed: 'Closed'
};

const MyTickets = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, feedback_text: '' });

  // Form state for raising a complaint
  const [raiseFormData, setRaiseFormData] = useState({
    category_id: '',
    sub_category_id: '',
    title: '',
    description: '',
    block_no: '',
    floor_no: '',
    room_no: ''
  });
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Fetch active categories from maintenance_db
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['complaint-categories-active'],
    queryFn: async () => {
      const response = await api.get(maintenanceApiUrl('/complaint-categories/active'));
      return response.data?.data || [];
    }
  });

  // Fetch student tickets from maintenance_db
  const {
    data: ticketsData,
    isLoading,
    isError,
    error: ticketsRequestError,
    refetch: refetchTickets
  } = useQuery({
    queryKey: ['student-tickets'],
    queryFn: async () => {
      const response = await api.get(maintenanceApiUrl('/tickets/student/my-tickets'));
      return response.data?.data || [];
    }
  });

  // Fetch ticket details
  const { data: ticketDetails } = useQuery({
    queryKey: ['ticket', selectedTicket?.id],
    queryFn: async () => {
      const response = await api.get(maintenanceApiUrl(`/tickets/${selectedTicket.id}`));
      return response.data?.data;
    },
    enabled: !!selectedTicket
  });

  // Create complaint mutation (pushes to maintenance_db)
  const createComplaintMutation = useMutation({
    mutationFn: async (formData) => {
      if (selectedPhotoFile) {
        const payload = new FormData();
        payload.append('category_id', formData.category_id);
        if (formData.sub_category_id) payload.append('sub_category_id', formData.sub_category_id);
        payload.append('title', formData.title.trim());
        if (formData.description) payload.append('description', formData.description.trim());
        if (formData.block_no) payload.append('block_no', formData.block_no.trim());
        if (formData.floor_no) payload.append('floor_no', formData.floor_no.trim());
        if (formData.room_no) payload.append('room_no', formData.room_no.trim());
        payload.append('photo', selectedPhotoFile);

        const response = await api.post(maintenanceApiUrl('/tickets'), payload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
      } else {
        const response = await api.post(maintenanceApiUrl('/tickets'), formData);
        return response.data;
      }
    },
    onSuccess: () => {
      toast.success('Complaint submitted successfully!');
      setShowRaiseModal(false);
      setRaiseFormData({
        category_id: '',
        sub_category_id: '',
        title: '',
        description: '',
        block_no: '',
        floor_no: '',
        room_no: ''
      });
      setSelectedPhotoFile(null);
      setPhotoPreview(null);
      queryClient.invalidateQueries({ queryKey: ['student-tickets'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to submit complaint');
    }
  });

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ ticketId, data }) => {
      const response = await api.post(maintenanceApiUrl(`/tickets/${ticketId}/feedback`), data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Feedback submitted successfully');
      setShowFeedbackModal(false);
      setFeedbackForm({ rating: 5, feedback_text: '' });
      queryClient.invalidateQueries({ queryKey: ['student-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicket?.id] });
      setSelectedTicket(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to submit feedback');
    }
  });

  // Reopen mutation
  const reopenMutation = useMutation({
    mutationFn: async (ticketId) => {
      const response = await api.post(maintenanceApiUrl(`/tickets/${ticketId}/reopen`));
      return response.data;
    },
    onSuccess: () => {
      toast.success('Complaint raised again. The maintenance team has been notified.');
      queryClient.invalidateQueries({ queryKey: ['student-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicket?.id] });
      setSelectedTicket(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to raise the complaint again');
    }
  });

  const tickets = ticketsData || [];
  const categories = categoriesData || [];
  const selectedCategory = categories.find((c) => String(c.id) === String(raiseFormData.category_id));

  const handleFeedbackSubmit = () => {
    if (!feedbackForm.rating) {
      toast.error('Please provide a rating');
      return;
    }
    feedbackMutation.mutate({
      ticketId: selectedTicket.id,
      data: feedbackForm
    });
  };

  const handleReopen = (ticketToReopen = selectedTicket) => {
    if (!ticketToReopen) return;
    if (window.confirm('This issue is not resolved. Raise it again for the maintenance team to investigate?')) {
      reopenMutation.mutate(ticketToReopen.id);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image file must be under 5MB');
        return;
      }
      setSelectedPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRaiseSubmit = (e) => {
    e.preventDefault();
    if (!raiseFormData.category_id) {
      toast.error('Please select a category');
      return;
    }
    if (!raiseFormData.title.trim()) {
      toast.error('Please enter a complaint subject / title');
      return;
    }
    createComplaintMutation.mutate(raiseFormData);
  };

  // Stats for the page header
  const totalCount = tickets.length;
  const pendingCount = tickets.filter((t) => t.status === 'pending' || t.status === 'approaching').length;
  const completedCount = tickets.filter((t) => t.status === 'completed' || t.status === 'closed').length;

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBox height="h-8" width="w-48" />
            <SkeletonBox height="h-4" width="w-64" />
          </div>
          <SkeletonBox height="h-10" width="w-40" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <SkeletonBox height="h-6" width="w-48" />
              <SkeletonBox height="h-4" width="w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="max-w-3xl mx-auto m-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h1 className="text-lg font-bold">Your complaints could not be loaded</h1>
        <p className="mt-2 text-sm">{ticketsRequestError.response?.data?.message || ticketsRequestError.message}</p>
        <button
          type="button"
          onClick={() => refetchTickets()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-3 sm:px-6 space-y-6 pb-12"
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Ticket size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Campus Maintenance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Maintenance & Complaints
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">
            Report facility issues and track real-time resolution status
          </p>
        </div>

        {/* Action Button: Opens the Complaint Popup Modal */}
        <button
          onClick={() => setShowRaiseModal(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 text-sm"
        >
          <Plus size={18} />
          <span>File a Complaint</span>
        </button>
      </div>

      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 text-center">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Total</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-800 mt-0.5">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200/80 bg-amber-50/30 p-3 sm:p-4 text-center">
          <p className="text-[11px] font-semibold text-amber-700 uppercase">Pending</p>
          <p className="text-lg sm:text-2xl font-bold text-amber-800 mt-0.5">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-3 sm:p-4 text-center">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase">Resolved</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-800 mt-0.5">{completedCount}</p>
        </div>
      </div>

      {/* Tickets List Area */}
      <AnimatePresence mode="wait">
        {tickets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-14 text-center shadow-sm"
          >
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Ticket size={32} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">No Complaints Logged</h3>
            <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto mb-6">
              Everything looks in good shape! You have not logged any maintenance or facility issues yet.
            </p>
            <button
              onClick={() => setShowRaiseModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-md shadow-blue-500/20 text-sm active:scale-95"
            >
              <Plus size={18} />
              <span>File Your First Complaint</span>
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {tickets.map((t, index) => {
              const ticketNum = t.complaint_number || t.ticket_number || `TKT-${t.id}`;
              return (
                <motion.div
                  key={t.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Title & Status */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors break-words">
                          {t.title}
                        </h3>
                        <span
                          className={`px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${STATUS_COLORS[t.status] || 'bg-slate-100'}`}
                        >
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                      </div>

                      {/* Meta badges: ID, Category, Date, Location */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mb-2">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono font-bold text-[11px]">
                          #{ticketNum}
                        </span>
                        {t.category_name && (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg font-medium text-[11px]">
                            {t.category_name} {t.sub_category_name ? `› ${t.sub_category_name}` : ''}
                          </span>
                        )}
                        {t.college_name && (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium text-[11px] flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400" />
                            {t.college_name}
                          </span>
                        )}
                        {(t.block_no || t.room_no) && (
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg font-medium text-[11px] flex items-center gap-1">
                            <MapPin size={12} className="text-indigo-500" />
                            {t.block_no ? `Block ${t.block_no}` : ''}
                            {t.room_no ? ` Room ${t.room_no}` : ''}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto sm:ml-0">
                          <Clock size={12} />
                          {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : ''}
                        </span>
                      </div>

                      {/* Description snippet */}
                      {t.description && (
                        <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      )}
                    </div>

                    {/* Action buttons on ticket card */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                        title="View Full Details"
                      >
                        <Eye size={15} />
                        <span>Details</span>
                      </button>

                      {t.status === 'completed' && !t.feedback && (
                        <button
                          onClick={() => {
                            setSelectedTicket(t);
                            setShowFeedbackModal(true);
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 shadow-sm"
                        >
                          <Star size={14} className="fill-white" />
                          <span>Rate</span>
                        </button>
                      )}

                      {t.status === 'completed' && (
                        <button
                          onClick={() => handleReopen(t)}
                          disabled={reopenMutation.isPending}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        >
                          <RefreshCw size={13} className={reopenMutation.isPending ? 'animate-spin' : ''} />
                          <span>Raise Again</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL: FILE A COMPLAINT */}
      <AnimatePresence>
        {showRaiseModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              className="bg-white rounded-t-[1.75rem] sm:rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Ticket size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">File a Maintenance Complaint</h2>
                    <p className="text-xs text-slate-400">Pushed directly to campus maintenance database</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleRaiseSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
                {/* Category Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={raiseFormData.category_id}
                      onChange={(e) =>
                        setRaiseFormData((prev) => ({
                          ...prev,
                          category_id: e.target.value,
                          sub_category_id: ''
                        }))
                      }
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition appearance-none text-xs sm:text-sm"
                    >
                      <option value="">Select complaint category...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
                  </div>
                  {selectedCategory?.description && (
                    <p className="text-[11px] text-blue-600 font-medium mt-1">
                      Tip: {selectedCategory.description}
                    </p>
                  )}
                </div>

                {/* Subcategory Selection (if category has subcategories) */}
                {selectedCategory?.sub_categories?.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Sub-Category <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <select
                        value={raiseFormData.sub_category_id}
                        onChange={(e) => setRaiseFormData((prev) => ({ ...prev, sub_category_id: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition appearance-none text-xs sm:text-sm"
                      >
                        <option value="">Select sub-category...</option>
                        {selectedCategory.sub_categories.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Complaint Title */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Subject / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={raiseFormData.title}
                    onChange={(e) => setRaiseFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Fan not rotating in classroom 204"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition text-xs sm:text-sm"
                  />
                </div>

                {/* Physical Location Fields (Mobile Responsive Grid) */}
                <div className="p-3 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <MapPin size={14} className="text-blue-600" />
                    <span>Location Details</span>
                    <span className="text-[11px] text-slate-400 font-normal">(Help technician locate issue)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Block</label>
                      <input
                        type="text"
                        value={raiseFormData.block_no}
                        onChange={(e) => setRaiseFormData((prev) => ({ ...prev, block_no: e.target.value }))}
                        placeholder="e.g. Block A"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:border-blue-500 outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Floor</label>
                      <input
                        type="text"
                        value={raiseFormData.floor_no}
                        onChange={(e) => setRaiseFormData((prev) => ({ ...prev, floor_no: e.target.value }))}
                        placeholder="e.g. 2nd Floor"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:border-blue-500 outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Room No</label>
                      <input
                        type="text"
                        value={raiseFormData.room_no}
                        onChange={(e) => setRaiseFormData((prev) => ({ ...prev, room_no: e.target.value }))}
                        placeholder="e.g. 204"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:border-blue-500 outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={raiseFormData.description}
                    onChange={(e) => setRaiseFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the problem, severity, or any additional context..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition text-xs sm:text-sm resize-none"
                  />
                </div>

                {/* Photo Upload Attachment */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Photo Evidence <span className="text-slate-400 font-normal">(Optional, max 5MB)</span>
                  </label>
                  {photoPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 w-full h-36 bg-slate-100">
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-lg hover:bg-slate-900 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition">
                      <Upload size={20} className="text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-600">Tap to upload a photo of the issue</span>
                      <span className="text-[10px] text-slate-400">PNG, JPG up to 5MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRaiseModal(false)}
                    className="w-1/3 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition text-xs sm:text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createComplaintMutation.isPending}
                    className="w-2/3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition active:scale-95 disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2"
                  >
                    {createComplaintMutation.isPending ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Submit Complaint</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket Details Modal */}
      {selectedTicket && !showFeedbackModal && (
        <TicketDetailsModal
          ticket={ticketDetails || selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onFeedback={() => {
            if (selectedTicket.status === 'completed' && !selectedTicket.feedback) {
              setShowFeedbackModal(true);
            }
          }}
          onReopen={() => handleReopen(selectedTicket)}
          isReopening={reopenMutation.isPending}
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
    </motion.div>
  );
};

// Ticket Details Modal Component
const TicketDetailsModal = ({ ticket, onClose, onFeedback, onReopen, isReopening }) => {
  const ticketNum = ticket.complaint_number || ticket.ticket_number || `TKT-${ticket.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-t-[1.75rem] sm:rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col"
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Complaint Details</h2>
            <p className="text-xs text-blue-600 font-mono font-bold">#{ticketNum}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${STATUS_COLORS[ticket.status] || 'bg-slate-100'}`}
            >
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={13} />
              {ticket.created_at ? new Date(ticket.created_at).toLocaleString('en-IN') : ''}
            </span>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Subject
            </label>
            <p className="text-base font-bold text-slate-900">{ticket.title}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Category
              </label>
              <p className="font-semibold text-slate-800">
                {ticket.category_name || 'General'}
                {ticket.sub_category_name ? ` › ${ticket.sub_category_name}` : ''}
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Requester
              </label>
              <p className="font-semibold text-slate-800">
                {ticket.requester_name || 'Student'} ({ticket.requester_identifier || ticket.admission_number || 'N/A'})
              </p>
            </div>
          </div>

          {(ticket.college_name || ticket.block_no || ticket.floor_no || ticket.room_no) && (
            <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl">
              <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <MapPin size={13} className="text-blue-600" /> Location Details
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-slate-700">
                {ticket.college_name && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">College</span>
                    <span>{ticket.college_name}</span>
                  </div>
                )}
                {ticket.block_no && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">Block</span>
                    <span>{ticket.block_no}</span>
                  </div>
                )}
                {ticket.floor_no && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">Floor</span>
                    <span>{ticket.floor_no}</span>
                  </div>
                )}
                {ticket.room_no && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">Room</span>
                    <span>{ticket.room_no}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {ticket.description && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Description
              </label>
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-700 leading-relaxed text-xs sm:text-sm">
                {ticket.description}
              </div>
            </div>
          )}

          {ticket.photo_url && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Attached Photo
              </label>
              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-64 bg-slate-50 flex items-center justify-center">
                <img
                  src={ticket.photo_url}
                  alt="Complaint attachment"
                  className="max-h-64 w-auto object-contain"
                />
              </div>
            </div>
          )}

          {/* Action buttons in modal */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-slate-100">
            {ticket.status === 'completed' && !ticket.feedback && (
              <button
                onClick={onFeedback}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Star size={14} className="fill-white" />
                <span>Rate Resolution</span>
              </button>
            )}

            {ticket.status === 'completed' && (
              <button
                onClick={onReopen}
                disabled={isReopening}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isReopening ? 'animate-spin' : ''} />
                <span>Not Done — Raise Again</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Feedback Modal Component
const FeedbackModal = ({ ticket, form, setForm, onClose, onSubmit, loading }) => {
  const ticketNum = ticket.complaint_number || ticket.ticket_number || `TKT-${ticket.id}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-100 text-center space-y-4"
      >
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle size={28} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Rate Maintenance Resolution</h3>
          <p className="text-xs text-slate-500 mt-1">
            How satisfied are you with the work done for #{ticketNum}?
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, rating: star }))}
              className="p-1 transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                size={32}
                className={form.rating >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
              />
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={form.feedback_text}
          onChange={(e) => setForm((prev) => ({ ...prev, feedback_text: e.target.value }))}
          placeholder="Optional remarks (e.g. prompt service, technician was polite)..."
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:bg-white focus:border-emerald-500 resize-none"
        />

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-bold text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 transition active:scale-95"
          >
            {loading ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default MyTickets;
