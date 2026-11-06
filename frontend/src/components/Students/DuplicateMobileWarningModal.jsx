import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Edit3, Eye, Smartphone, Users, ShieldAlert } from 'lucide-react';
import StudentAvatar from '../StudentAvatar';
import { getStudentMobileNumbers, checkSameStudentAndParentMobile } from '../../utils/mobileValidation';

const DuplicateMobileWarningModal = ({
  isOpen,
  onClose,
  student,
  onChangeMobile,
  onViewDetails
}) => {
  if (!isOpen || !student) return null;

  const { studentMobile, parentMobile1, parentMobile2 } = getStudentMobileNumbers(student);
  const dupCheck = checkSameStudentAndParentMobile(studentMobile, parentMobile1, parentMobile2);

  const matchedParentLabel = dupCheck.matchedLabel || 'Parent Mobile';
  const matchedParentNumber = dupCheck.matchedField === 'parent_mobile2' ? parentMobile2 : parentMobile1;

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--sidebar)]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-surface rounded-2xl shadow-2xl border border-[var(--warning-light)] w-full max-w-lg overflow-hidden transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Amber Warning Gradient */}
        <div className="bg-gradient-to-r from-warning via-warning to-warning text-white p-5 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-6 text-white/15 pointer-events-none">
            <ShieldAlert size={110} />
          </div>
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[var(--surface)]/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                <AlertTriangle size={24} className="text-warning animate-bounce" />
              </div>
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--surface)]/25 text-white mb-1">
                  Action Required
                </span>
                <h2 className="text-lg font-bold leading-tight">Duplicate Mobile Number Detected</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-[var(--surface)]/20 p-1.5 rounded-lg transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Student Info Card */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
            <StudentAvatar
              admissionNumber={student.admission_number}
              studentName={student.student_name}
              className="w-12 h-12 rounded-full border-2 border-surface shadow-xs"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-main text-sm truncate" title={student.student_name}>
                {student.student_name || 'Student Name'}
              </h3>
              <p className="text-xs text-muted-text font-mono">
                Admission: <span className="font-semibold text-main">{student.admission_number || '-'}</span>
                {student.pin_no && (
                  <span className="ml-2 font-semibold text-success bg-[var(--success-light)] px-1.5 py-0.2 rounded border border-[var(--success-light)]">
                    PIN: {student.pin_no}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-text truncate mt-0.5">
                {[student.course, student.branch, student.batch].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>

          {/* Numbers Comparison Card */}
          <div className="rounded-xl border border-[var(--warning-light)] bg-[var(--warning-light)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-warning flex items-center gap-1.5">
                <Smartphone size={14} className="text-warning" />
                Conflicting Phone Numbers
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]">
                Identical Numbers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-surface p-2.5 rounded-lg border border-[var(--warning-light)] shadow-2xs">
                <p className="text-muted-text text-[11px] font-semibold mb-0.5">Student Mobile</p>
                <p className="font-mono font-bold text-main text-sm flex items-center gap-1">
                  <span>{studentMobile || '-'}</span>
                </p>
              </div>
              <div className="bg-surface p-2.5 rounded-lg border border-[var(--warning-light)] shadow-2xs">
                <p className="text-muted-text text-[11px] font-semibold mb-0.5">{matchedParentLabel}</p>
                <p className="font-mono font-bold text-main text-sm flex items-center gap-1">
                  <span>{matchedParentNumber || '-'}</span>
                </p>
              </div>
            </div>

            <div className="text-[11px] text-warning leading-relaxed bg-[var(--warning-light)] p-2.5 rounded-lg border border-[var(--warning-light)]">
              <strong>Notice:</strong> The student mobile number and the parent mobile number cannot be identical. 
              Each must be distinct for SMS delivery, parent portal login access, and official academic communications.
            </div>
          </div>

          <p className="text-xs text-sub text-center font-medium">
            Please update either the student or parent mobile number to resolve this conflict.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-background border-t border-border flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-sub hover:text-main hover:bg-[var(--background)]/70 transition-colors order-3 sm:order-1"
          >
            Cancel
          </button>
          {onViewDetails && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewDetails(student);
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-sub bg-surface border border-border-strong hover:bg-background transition-colors flex items-center justify-center gap-1.5 order-2"
            >
              <Eye size={13} /> View Profile
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onChangeMobile) {
                onChangeMobile(student);
              } else if (onViewDetails) {
                onViewDetails(student);
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-warning to-warning hover:from-warning hover:to-warning shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 order-1 sm:order-3"
          >
            <Edit3 size={14} /> Change Mobile Number Now
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DuplicateMobileWarningModal;
