import React, { useState } from 'react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
  Sparkles,
  X,
  MapPin,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';

import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending: 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]',
  approaching: 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]',
  resolving: 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]',
  completed: 'bg-[var(--success-light)] text-success border-[var(--success-light)]',
  closed: 'bg-background text-main border-border'
};

const STATUS_LABELS = {
  pending: 'Pending',
  approaching: 'Approaching',
  resolving: 'Resolving',
  completed: 'Completed',
  closed: 'Closed'
};

const MyTickets = () => {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, feedback_text: '' });

  // Fetch student tickets
  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['student-tickets'],
    queryFn: async () => {
      const response = await api.get('/tickets/student/my-tickets');
      return response.data?.data || [];
    }
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
      toast.success('Feedback submitted successfully');
      setShowFeedbackModal(false);
      setFeedbackForm({ rating: 5, feedback_text: '' });
      setSelectedTicket(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to submit feedback');
    }
  });

  const tickets = ticketsData || [];
  const ticket = ticketDetails || selectedTicket;

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

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonBox height="h-8" width="w-48" />
            <SkeletonBox height="h-4" width="w-64" />
          </div>
          <SkeletonBox height="h-10" width="w-40" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-lg border p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <SkeletonBox height="h-6" width="w-64" />
                    <SkeletonBox height="h-6" width="w-24" className="rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <SkeletonBox height="h-4" width="w-48" />
                    <SkeletonBox height="h-4" width="w-56" />
                    <SkeletonBox height="h-4" width="w-40" />
                  </div>
                  <SkeletonBox height="h-16" width="w-full" className="rounded-lg" />
                </div>
                <div className="ml-4">
                  <SkeletonBox height="h-10" width="w-10" className="rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Ticket size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Support Portal</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-main heading-font tracking-tight">
            Ticket History
          </h1>
          <p className="text-muted-text text-sm lg:text-base font-medium">
            View and track your previous assistance requests
          </p>
        </div>
        <Link
          to="/student/raise-ticket"
          className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover shadow-xl shadow-primary transition-all hover:-translate-y-1 active:scale-95"
        >
          <Plus size={20} className="transition-transform group-hover:rotate-90 duration-300" />
          <span>Raise New Ticket</span>
        </Link>
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {tickets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative overflow-hidden bg-surface rounded-[2rem] border border-border p-12 lg:p-20 text-center shadow-2xl shadow-border/50"
          >
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary-light)] rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--primary-light)] rounded-full -ml-32 -mb-32 blur-3xl"></div>

            <div className="relative z-10 max-w-md mx-auto">
              <div className="w-24 h-24 bg-[var(--primary-light)] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner rotate-3 group hover:rotate-6 transition-transform">
                <Ticket className="text-primary" size={48} />
              </div>
              <h3 className="text-2xl lg:text-3xl font-black text-main mb-4 heading-font">
                No History Yet
              </h3>
              <p className="text-muted-text mb-10 leading-relaxed font-medium">
                Everything looks good! You haven't raised any complaints or assistance requests yet.
              </p>
              <Link
                to="/student/raise-ticket"
                className="inline-flex items-center gap-3 px-8 py-4 bg-sidebar text-white rounded-2xl font-bold hover:bg-black shadow-2xl shadow-border transition-all hover:-translate-y-1 active:scale-95 group"
              >
                <Sparkles size={20} className="text-primary group-hover:animate-pulse" />
                <span>Create Your First Ticket</span>
                <Plus size={20} />
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {tickets.map((ticket, index) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                key={ticket.id}
                className="bg-surface rounded-2xl border border-border p-6 hover:shadow-md hover:-translate-y-1 hover:border-[var(--primary-light)] transition-all duration-300 group relative overflow-hidden"
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <h3 className="text-xl font-bold text-main heading-font group-hover:text-primary transition-colors">{ticket.title}</h3>
                      <span className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${STATUS_COLORS[ticket.status] || 'bg-background'}`}>
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border border-border">
                        <span className="text-[10px] font-bold text-muted-text uppercase tracking-tighter">ID:</span>
                        <code className="text-xs font-mono font-bold text-primary">{ticket.ticket_number}</code>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border border-border">
                        <span className="text-[10px] font-bold text-muted-text uppercase tracking-tighter">Type:</span>
                        <span className="text-xs font-bold text-sub">{ticket.category_name}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border border-border">
                        <Clock size={12} className="text-muted-text" />
                        <span className="text-xs font-bold text-sub">{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                      {/* Location Badges */}
                      {ticket.college_name && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-light)] text-primary rounded-lg border border-[var(--primary-light)] text-xs font-bold">
                          <Building2 size={12} className="text-primary" />
                          <span className="text-[9px] uppercase font-black text-primary">College:</span>
                          <span>{ticket.college_name}</span>
                        </div>
                      )}
                      {ticket.block_no && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-light)] text-primary rounded-lg border border-[var(--primary-light)] text-xs font-bold">
                          <span className="text-[9px] uppercase font-black text-primary">Block:</span>
                          <span>{ticket.block_no}</span>
                        </div>
                      )}
                      {ticket.floor_no && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-light)] text-secondary rounded-lg border border-[var(--primary-light)] text-xs font-bold">
                          <span className="text-[9px] uppercase font-black text-secondary">Floor:</span>
                          <span>{ticket.floor_no}</span>
                        </div>
                      )}
                      {ticket.room_no && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--success-light)] text-success rounded-lg border border-[var(--success-light)] text-xs font-bold">
                          <span className="text-[9px] uppercase font-black text-success">Room:</span>
                          <span>{ticket.room_no}</span>
                        </div>
                      )}
                    </div>

                    {ticket.description && (
                      <p className="text-sm text-muted-text line-clamp-2 leading-relaxed max-w-3xl italic">"{ticket.description}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 ml-6 self-center">
                    <button
                      onClick={() => setSelectedTicket(ticket)}
                      className="p-3 text-primary bg-[var(--primary-light)] hover:bg-primary hover:text-white rounded-2xl transition-all shadow-sm group/btn active:scale-90"
                      title="View Details"
                    >
                      <Eye size={22} className="group-hover/btn:scale-110 transition-transform" />
                    </button>

                    {ticket.status === 'completed' && !ticket.feedback && (
                      <button
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setShowFeedbackModal(true);
                        }}
                        className="px-5 py-2.5 bg-success text-white rounded-2xl hover:bg-success text-sm font-bold flex items-center gap-2 shadow-lg shadow-success hover:shadow-success transition-all active:scale-95"
                      >
                        <MessageSquare size={18} />
                        Feedback
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Modal Section */}
      {selectedTicket && !showFeedbackModal && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onFeedback={() => {
            if (selectedTicket.status === 'completed' && !selectedTicket.feedback) {
              setShowFeedbackModal(true);
            }
          }}
        />
      )}

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

// Ticket Details Modal
const TicketDetailsModal = ({ ticket, onClose, onFeedback }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[var(--sidebar)]/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 lg:p-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-[2.5rem] max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-surface relative"
      >
        {/* Header Container */}
        <div className="sticky top-0 bg-[var(--surface)]/80 backdrop-blur-md z-20 px-8 py-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-main heading-font">Ticket Details</h2>
            <p className="text-xs text-primary font-bold tracking-widest uppercase mt-0.5">Reference: {ticket.ticket_number}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-background text-muted-text hover:bg-background hover:text-main rounded-2xl transition-all active:scale-95 shadow-sm">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 lg:p-10 space-y-10">
          <div className="flex flex-wrap items-center gap-4">
            <div className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm ${STATUS_COLORS[ticket.status] || 'bg-background'}`}>
              {STATUS_LABELS[ticket.status] || ticket.status}
            </div>
            <div className="flex items-center gap-2 text-muted-text text-sm font-medium">
              <Clock size={16} />
              <span>Created {new Date(ticket.created_at).toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-muted-text tracking-tighter">Category & Type</label>
                <p className="text-lg font-bold text-main">
                  {ticket.category_name}
                  {ticket.sub_category_name && <span className="text-primary ml-2">› {ticket.sub_category_name}</span>}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-muted-text tracking-tighter">Subject</label>
                <p className="text-lg font-bold text-main leading-tight">{ticket.title}</p>
              </div>

              {/* Physical Location Details */}
              {(ticket.college_name || ticket.block_no || ticket.floor_no || ticket.room_no) && (
                <div className="p-4 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-2xl space-y-2">
                  <div className="text-[11px] font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={14} className="text-primary" /> Physical Location
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-bold text-primary">
                    {ticket.college_name && (
                      <div>
                        <span className="text-[10px] text-primary uppercase block font-semibold">College</span>
                        <span>{ticket.college_name}</span>
                      </div>
                    )}
                    {ticket.block_no && (
                      <div>
                        <span className="text-[10px] text-primary uppercase block font-semibold">Block</span>
                        <span>{ticket.block_no}</span>
                      </div>
                    )}
                    {ticket.floor_no && (
                      <div>
                        <span className="text-[10px] text-primary uppercase block font-semibold">Floor</span>
                        <span>{ticket.floor_no}</span>
                      </div>
                    )}
                    {ticket.room_no && (
                      <div>
                        <span className="text-[10px] text-primary uppercase block font-semibold">Room No</span>
                        <span>{ticket.room_no}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {ticket.photo_url && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-muted-text tracking-tighter">Evidence / Attachment</label>
                <div className="rounded-3xl overflow-hidden border-4 border-border shadow-inner group">
                  <img
                    src={ticket.photo_url}
                    alt="Ticket attachment"
                    className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black text-muted-text tracking-tighter">Detailed Description</label>
            <div className="p-6 bg-background rounded-3xl border border-border">
              <p className="text-sub leading-relaxed font-medium whitespace-pre-wrap italic">"{ticket.description}"</p>
            </div>
          </div>

          {ticket.feedback && (
            <div className="p-8 bg-[var(--success-light)] rounded-[2rem] border border-[var(--success-light)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Star size={80} className="text-success" />
              </div>
              <h4 className="text-lg font-black text-success mb-4 flex items-center gap-2">
                <MessageSquare size={20} />
                Your Feedback
              </h4>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={20}
                      className={star <= ticket.feedback.rating ? "fill-success text-success" : "text-success"}
                    />
                  ))}
                </div>
                <span className="font-black text-success ml-2 text-xl">{ticket.feedback.rating}/5</span>
              </div>
              {ticket.feedback.feedback_text && (
                <p className="text-success font-medium leading-relaxed italic">"{ticket.feedback.feedback_text}"</p>
              )}
            </div>
          )}

          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {ticket.status === 'completed' && !ticket.feedback && (
                <button
                  onClick={onFeedback}
                  className="px-8 py-3 bg-success text-white rounded-2xl font-black hover:bg-success transition-all shadow-lg shadow-success flex items-center gap-2 active:scale-95"
                >
                  <Star size={18} />
                  Rate Resolution
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-3 bg-sidebar text-white rounded-2xl font-bold hover:bg-black transition-all active:scale-95"
            >
              Close Details
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Feedback Modal
const FeedbackModal = ({ ticket, form, setForm, onClose, onSubmit, loading }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-[var(--sidebar)]/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-[2.5rem] max-w-md w-full shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-border text-center">
          <div className="w-16 h-16 bg-[var(--success-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-success" size={32} />
          </div>
          <h2 className="text-2xl font-black text-main heading-font">Rate Resolution</h2>
          <p className="text-muted-text font-medium mt-1">How was your experience with Ticket #{ticket.ticket_number}?</p>
        </div>

        <div className="p-8 space-y-8">
          <div className="text-center">
            <label className="block text-xs font-black text-muted-text uppercase tracking-widest mb-4">Select Rating</label>
            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setForm({ ...form, rating })}
                  className={`group relative p-2 transition-all duration-300 ${form.rating >= rating ? 'scale-125' : 'grayscale opacity-30 hover:grayscale-0 hover:opacity-100 hover:scale-110'}`}
                >
                  <Star
                    size={40}
                    className={form.rating >= rating ? 'fill-warning text-warning drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'text-muted-text'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-muted-text tracking-tighter px-1">Detailed Feedback</label>
            <textarea
              value={form.feedback_text}
              onChange={(e) => setForm({ ...form, feedback_text: e.target.value })}
              className="w-full px-4 py-4 bg-background border-2 border-transparent rounded-2xl focus:bg-surface focus:border-success focus:ring-4 focus:ring-[var(--success-light)] transition-all outline-none font-medium resize-none"
              rows={4}
              placeholder="Tell us what we did great or how we can improve..."
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={onSubmit}
              disabled={loading || !form.rating}
              className="w-full py-4 bg-success text-white rounded-2xl font-black text-lg hover:bg-success disabled:opacity-50 transition-all shadow-xl shadow-success active:scale-95"
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 text-muted-text font-bold hover:text-main transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MyTickets;


