import React, { useState, useEffect } from 'react';
import {
    MessageSquare,
    Plus,
    Loader2,
    Trash2,
    Edit2,
    Check,
    Clock,
    User
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const ROLE_STYLES = {
    'Admin': {
        bg: 'bg-[var(--danger-light)]',
        text: 'text-danger',
        border: 'border-[var(--danger-light)]',
        accent: 'bg-danger'
    },
    'Principal': {
        bg: 'bg-[var(--primary-light)]',
        text: 'text-primary',
        border: 'border-[var(--primary-light)]',
        accent: 'bg-primary'
    },
    'AO': {
        bg: 'bg-[var(--primary-light)]',
        text: 'text-secondary',
        border: 'border-[var(--primary-light)]',
        accent: 'bg-secondary'
    },
    'HOD': {
        bg: 'bg-[var(--warning-light)]',
        text: 'text-warning',
        border: 'border-[var(--warning-light)]',
        accent: 'bg-warning'
    },
    'Initial': {
        bg: 'bg-background',
        text: 'text-sub',
        border: 'border-border',
        accent: 'bg-background'
    },
    'Other': {
        bg: 'bg-[var(--success-light)]',
        text: 'text-success',
        border: 'border-[var(--success-light)]',
        accent: 'bg-success'
    }
};

const StudentRemarksContent = ({ student, canAddRemarks = false, canManageRemarks = false }) => {
    const [remarks, setRemarks] = useState([]);
    const [loadingRemarks, setLoadingRemarks] = useState(false);
    const [newRemark, setNewRemark] = useState('');
    const [addingRemark, setAddingRemark] = useState(false);
    const [editingRemarkId, setEditingRemarkId] = useState(null);
    const [editingRemarkText, setEditingRemarkText] = useState('');
    const [updatingRemark, setUpdatingRemark] = useState(false);
    const [deletingRemarkId, setDeletingRemarkId] = useState(null);

    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        if (student?.admission_number) {
            fetchRemarks();
        }
    }, [student]);

    const fetchRemarks = async () => {
        setLoadingRemarks(true);
        try {
            const response = await api.get(`/student-history/remarks/${student.admission_number}`);
            if (response.data.success) {
                setRemarks(response.data.data);
            }
        } catch (error) {
            toast.error('Failed to load remarks');
        } finally {
            setLoadingRemarks(false);
        }
    };

    const handleAddRemark = async (e) => {
        e.preventDefault();
        if (!newRemark.trim() || !canAddRemarks) return;

        setAddingRemark(true);
        try {
            const response = await api.post('/student-history/remarks', {
                admission_number: student.admission_number,
                remark: newRemark
            });

            if (response.data.success) {
                toast.success('Remark added');
                setNewRemark('');
                fetchRemarks();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add remark');
        } finally {
            setAddingRemark(false);
        }
    };

    const handleUpdateRemark = async (remarkId) => {
        if (!editingRemarkText.trim() || !canManageRemarks) return;

        setUpdatingRemark(true);
        try {
            const response = await api.put(`/student-history/remarks/${remarkId}`, {
                remark: editingRemarkText
            });

            if (response.data.success) {
                toast.success('Remark updated');
                setEditingRemarkId(null);
                setEditingRemarkText('');
                fetchRemarks();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update remark');
        } finally {
            setUpdatingRemark(false);
        }
    };

    const handleDeleteRemark = async (remarkId) => {
        if (!canManageRemarks) return;
        if (!window.confirm('Are you sure you want to delete this remark?')) return;

        setDeletingRemarkId(remarkId);
        try {
            const response = await api.delete(`/student-history/remarks/${remarkId}`);

            if (response.data.success) {
                toast.success('Remark deleted');
                fetchRemarks();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete remark');
        } finally {
            setDeletingRemarkId(null);
        }
    };

    const canEditRemark = (remark) => {
        if (remark.is_legacy || String(remark.id).startsWith('legacy-')) return false;
        const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';
        const isCreator = remark.created_by === user?.id;
        return (isSuperAdmin || isCreator) && canManageRemarks;
    };

    if (!student) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Remarks List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[var(--background)]/30">
                {loadingRemarks ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-text">
                        <Loader2 className="animate-spin mb-3" size={32} />
                        <p className="text-sm font-medium">Fetching remarks...</p>
                    </div>
                ) : remarks.length > 0 ? (
                    <div className="relative pt-2 pb-8">
                        {/* Vertical Timeline Thread */}
                        <div className="absolute left-[22px] top-0 bottom-8 w-0.5 bg-background rounded-full" />

                        <div className="space-y-6">
                            {remarks.map((remark) => {
                                const style = ROLE_STYLES[remark.remark_category] || ROLE_STYLES['Other'];
                                return (
                                    <div key={remark.id} className="relative pl-12">
                                        {/* Timeline Dot */}
                                        <div className={`absolute left-[15px] top-4 w-4 h-4 rounded-full border-4 border-surface shadow-sm z-10 ${style.accent}`} />

                                        <div className={`group relative bg-surface p-5 rounded-2xl border border-border shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 border-l-4 ${style.accent.replace('bg-', 'border-l-')}`}>
                                            {editingRemarkId === remark.id ? (
                                                <div className="space-y-3">
                                                    <textarea
                                                        value={editingRemarkText}
                                                        onChange={(e) => setEditingRemarkText(e.target.value)}
                                                        className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none text-sm min-h-[100px]"
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingRemarkId(null);
                                                                setEditingRemarkText('');
                                                            }}
                                                            className="px-3 py-1.5 text-xs font-medium text-sub hover:bg-background rounded-lg transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateRemark(remark.id)}
                                                            disabled={updatingRemark || !editingRemarkText.trim()}
                                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-lg shadow-primary"
                                                        >
                                                            {updatingRemark ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                            Update
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <span className="font-bold text-main tracking-tight">{remark.created_by_name}</span>
                                                            <span className="text-muted-text font-light">•</span>
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${style.bg} ${style.text} ${style.border} border`}>
                                                                {remark.remark_category}
                                                            </span>
                                                        </div>

                                                        {canEditRemark(remark) && (
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingRemarkId(remark.id);
                                                                        setEditingRemarkText(remark.remark);
                                                                    }}
                                                                    className="p-1.5 text-primary hover:bg-[var(--primary-light)] rounded-lg transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteRemark(remark.id)}
                                                                    disabled={deletingRemarkId === remark.id}
                                                                    className="p-1.5 text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    {deletingRemarkId === remark.id ? (
                                                                        <Loader2 size={14} className="animate-spin" />
                                                                    ) : (
                                                                        <Trash2 size={14} />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="pl-0">
                                                        <p className="text-main text-[15px] leading-relaxed whitespace-pre-wrap font-medium break-words">
                                                            {remark.remark}
                                                        </p>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <div className="flex items-center gap-3 text-[11px] text-muted-text font-semibold">
                                                                <span className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-lg">
                                                                    <Clock size={12} className="text-muted-text" />
                                                                    {new Date(remark.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                                </span>
                                                                {remark.student_year && (
                                                                    <span className="px-2 py-1 bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] rounded-lg">
                                                                        Year {remark.student_year} • Sem {remark.student_semester}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {remark.updated_at && (
                                                                <span className="text-[10px] text-muted-text italic">
                                                                    Edited
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-text bg-surface rounded-2xl border-2 border-dashed border-border">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <p className="text-base font-medium">No remarks found for this student</p>
                        <p className="text-xs mt-1">Add a new remark below to get started</p>
                    </div>
                )}
            </div>

            {/* Footer/Add Remark */}
            {canAddRemarks && (
                <div className="p-4 sm:p-5 border-t border-border bg-[var(--background)]/50 backdrop-blur-sm">
                    <form onSubmit={handleAddRemark} className="space-y-4">
                        <div className="relative group">
                            <textarea
                                value={newRemark}
                                onChange={(e) => setNewRemark(e.target.value)}
                                placeholder="Write a note about this student..."
                                className="w-full p-4 pr-14 bg-surface border border-border rounded-[20px] shadow-sm focus:ring-4 focus:ring-[var(--primary-light)] focus:border-primary outline-none transition-all resize-none text-[14px] min-h-[80px] font-medium placeholder:text-muted-text"
                            />
                            <div className="absolute top-4 right-6 text-muted-text group-focus-within:text-primary transition-colors pointer-events-none">
                                <MessageSquare size={20} className="opacity-40" />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-[var(--primary-light)] flex items-center justify-center border border-[var(--primary-light)]">
                                    <User size={13} className="text-primary" />
                                </div>
                                <p className="text-[10px] text-muted-text font-bold uppercase tracking-wider">
                                    Posting as <span className="text-primary underline decoration-primary decoration-2 underline-offset-4">{user?.username}</span>
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={addingRemark || !newRemark.trim()}
                                className="w-full sm:w-auto px-8 py-3 bg-primary text-white rounded-[16px] font-extrabold text-xs hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary hover:shadow-primary active:scale-[0.98] ring-4 ring-white"
                            >
                                {addingRemark ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} strokeWidth={3} /> Post Remark</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default StudentRemarksContent;
