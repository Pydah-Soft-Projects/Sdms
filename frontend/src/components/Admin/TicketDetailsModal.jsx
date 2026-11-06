import React from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    UserPlus,
    Edit,
    MessageSquare,
    Star,
    Clock,
    User,
    CheckCircle,
    AlertCircle,
    MapPin
} from 'lucide-react';
import TicketStepper from './TicketStepper';

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

const TicketDetailsModal = ({ ticket, onClose, onAssign, onStatusUpdate, onAddComment }) => {
    if (!ticket) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                className="fixed inset-0"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="relative bg-surface rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface z-20">
                    <div>
                        <h2 className="text-xl font-bold text-main">Ticket Details</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-primary uppercase tracking-wider bg-[var(--primary-light)] px-2 py-0.5 rounded">
                                Ref: {ticket.ticket_number}
                            </span>
                            <span className="text-xs text-muted-text flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(ticket.created_at).toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-background rounded-full text-muted-text hover:text-sub transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">

                    {/* Stepper */}
                    <div className="py-2">
                        <TicketStepper status={ticket.status} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Left Column: Details */}
                        <div className="md:col-span-2 space-y-6">

                            {/* Main Info Card */}
                            <div className="bg-background rounded-xl p-5 border border-border space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-muted-text uppercase tracking-wider mb-1 block">Subject</label>
                                    <h3 className="text-lg font-bold text-main leading-tight">{ticket.title}</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-muted-text uppercase tracking-wider mb-1 block">Category</label>
                                        <div className="font-medium text-main">
                                            {ticket.category_name}
                                            {ticket.sub_category_name && (
                                                <span className="text-muted-text text-sm block">› {ticket.sub_category_name}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-text uppercase tracking-wider mb-1 block">Student</label>
                                        <div className="font-medium text-main">{ticket.student_name}</div>
                                        <div className="text-sm text-muted-text">{ticket.admission_number}</div>
                                    </div>
                                </div>

                                {/* Physical Location Details */}
                                {(ticket.college_name || ticket.block_no || ticket.floor_no || ticket.room_no) && (
                                    <div className="p-4 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-xl space-y-2">
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

                                <div>
                                    <label className="text-xs font-bold text-muted-text uppercase tracking-wider mb-1 block">Description</label>
                                    <p className="text-sub whitespace-pre-wrap text-sm leading-relaxed">
                                        {ticket.description || <span className="italic text-muted-text">No description provided.</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Photo */}
                            {ticket.photo_url && (
                                <div>
                                    <label className="text-xs font-bold text-muted-text uppercase tracking-wider mb-2 block">Attachment</label>
                                    <div className="rounded-xl overflow-hidden border border-border bg-background">
                                        <img src={ticket.photo_url} alt="Ticket attachment" className="w-full h-auto max-h-[300px] object-contain" />
                                    </div>
                                </div>
                            )}

                            {/* Comments Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-main flex items-center gap-2">
                                        <MessageSquare size={20} className="text-muted-text" />
                                        Comments History
                                    </h3>
                                </div>

                                {ticket.comments && ticket.comments.length > 0 ? (
                                    <div className="space-y-4">
                                        {ticket.comments.map((comment) => (
                                            <div
                                                key={comment.id}
                                                className={`p-4 rounded-xl border ${comment.is_internal ? 'bg-[var(--warning-light)] border-[var(--warning-light)]' : 'bg-surface border-border'}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${comment.is_internal ? 'bg-[var(--warning-light)] text-warning' : 'bg-background text-sub'}`}>
                                                            {comment.user_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-main">{comment.user_name}</p>
                                                            <p className="text-xs text-muted-text">{new Date(comment.created_at).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    {comment.is_internal && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--warning-light)] text-warning px-2 py-1 rounded-full">Internal Note</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-sub ml-10">{comment.comment_text}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 bg-background rounded-xl border border-dashed border-border">
                                        <MessageSquare className="mx-auto text-muted-text mb-2" size={24} />
                                        <p className="text-sm text-muted-text">No comments yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Meta & Actions */}
                        <div className="space-y-6">
                            {/* Status Box */}
                            <div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
                                <label className="text-xs font-bold text-muted-text uppercase tracking-wider mb-2 block">Current Status</label>
                                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-bold border ${STATUS_COLORS[ticket.status] || 'bg-background'}`}>
                                    {STATUS_LABELS[ticket.status] || ticket.status}
                                </div>
                            </div>

                            {/* Assignments Box */}
                            <div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
                                <label className="text-xs font-bold text-muted-text uppercase tracking-wider mb-3 block">Assigned Staff</label>
                                {ticket.assignments && ticket.assignments.length > 0 ? (
                                    <div className="space-y-3">
                                        {ticket.assignments.map((assignment) => (
                                            <div key={assignment.id} className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[var(--primary-light)] text-primary flex items-center justify-center shrink-0">
                                                    <User size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-main">{assignment.assigned_to_name}</p>
                                                    <p className="text-xs text-muted-text capitalize">{assignment.assigned_to_role}</p>
                                                    <p className="text-[10px] text-muted-text mt-0.5">
                                                        {new Date(assignment.assigned_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-text italic flex items-center gap-2">
                                        <AlertCircle size={14} /> Not assigned yet
                                    </div>
                                )}
                            </div>

                            {/* Feedback Box (if completed) */}
                            {ticket.feedback && (
                                <div className="bg-[var(--success-light)] rounded-xl border border-[var(--success-light)] p-4">
                                    <label className="text-xs font-bold text-success uppercase tracking-wider mb-2 block flex items-center gap-1">
                                        <Star size={12} className="fill-success" /> Student Feedback
                                    </label>
                                    <div className="flex items-center gap-1 mb-2">
                                        <span className="text-2xl font-bold text-success">{ticket.feedback.rating}</span>
                                        <span className="text-sm text-success font-medium">/ 5</span>
                                    </div>
                                    {ticket.feedback.feedback_text && (
                                        <p className="text-sm text-success italic">"{ticket.feedback.feedback_text}"</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border bg-background flex flex-wrap items-center justify-end gap-3 z-20">
                    <button
                        onClick={onAssign}
                        className="px-4 py-2 bg-surface border border-border-strong text-sub rounded-lg hover:bg-background font-medium flex items-center gap-2 shadow-sm transition-all"
                    >
                        <UserPlus size={18} />
                        Assign Staff
                    </button>
                    <button
                        onClick={onStatusUpdate}
                        className="px-4 py-2 bg-surface border border-border-strong text-sub rounded-lg hover:bg-background font-medium flex items-center gap-2 shadow-sm transition-all"
                    >
                        <Edit size={18} />
                        Update Status
                    </button>
                    <button
                        onClick={onAddComment}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium flex items-center gap-2 shadow-sm transition-all"
                    >
                        <MessageSquare size={18} />
                        Add Comment
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};

export default TicketDetailsModal;
