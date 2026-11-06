import React from 'react';
import { MessageSquare, X } from 'lucide-react';
import StudentRemarksContent from './StudentRemarksContent';

const StudentRemarksModal = ({ isOpen, onClose, student, canAddRemarks = false, canManageRemarks = false }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] max-h-[900px] flex flex-col overflow-hidden border border-border">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-[var(--primary-light)] to-[var(--primary-light)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-main leading-none mb-1">Remarks History</h3>
                            <p className="text-xs text-muted-text font-medium">
                                {student?.student_name} • {student?.admission_number}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--surface)]/80 rounded-full transition-all text-muted-text hover:text-sub"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <StudentRemarksContent
                        student={student}
                        canAddRemarks={canAddRemarks}
                        canManageRemarks={canManageRemarks}
                    />
                </div>
            </div>
        </div>
    );
};

export default StudentRemarksModal;

