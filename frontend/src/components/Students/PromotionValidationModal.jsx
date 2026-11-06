import React, { useMemo } from 'react';
import { X, Calendar, AlertTriangle, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

const PromotionValidationModal = ({ 
  isOpen, 
  onClose, 
  currentSemesterData, 
  nextSemesterData, 
  onProceed, 
  onUpdateEndDate 
}) => {
  const isFutureEndDate = useMemo(() => {
    if (currentSemesterData && currentSemesterData.endDate) {
      const endDate = new Date(currentSemesterData.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      return endDate > today;
    }
    return false;
  }, [currentSemesterData]);

  const hasNextStartDateError = !nextSemesterData || !nextSemesterData.startDate;

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not Set';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--primary-light)]">
          <div>
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <Calendar size={18} className="text-primary" />
              Promotion Validation
            </h2>
            <p className="text-xs text-primary mt-1">
              Review semester dates before promoting the student
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--primary-light)] text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Dates Overview */}
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-background border border-border rounded-lg p-3">
              <div className="text-xs font-semibold text-muted-text uppercase mb-1">Current Semester</div>
              <div className="font-medium text-main">
                {currentSemesterData ? `Year ${currentSemesterData.yearOfStudy} - Sem ${currentSemesterData.semesterNumber}` : 'N/A'}
              </div>
              <div className="text-sm text-sub mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Start:</span>
                  <span className="font-medium">{formatDate(currentSemesterData?.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>End:</span>
                  <span className={`font-medium ${isFutureEndDate ? 'text-warning' : ''}`}>
                    {formatDate(currentSemesterData?.endDate)}
                  </span>
                </div>
              </div>
            </div>

            <ArrowRight className="text-muted-text shrink-0" size={24} />

            <div className="flex-1 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg p-3">
              <div className="text-xs font-semibold text-primary uppercase mb-1">Next Semester</div>
              <div className="font-medium text-primary">
                {nextSemesterData ? `Year ${nextSemesterData.yearOfStudy} - Sem ${nextSemesterData.semesterNumber}` : 'N/A'}
              </div>
              <div className="text-sm text-primary mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Start:</span>
                  <span className={`font-medium ${hasNextStartDateError ? 'text-danger' : ''}`}>
                    {formatDate(nextSemesterData?.startDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>End:</span>
                  <span className="font-medium">{formatDate(nextSemesterData?.endDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Validation Messages */}
          <div className="space-y-3">
            {hasNextStartDateError && (
              <div className="bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-lg p-4 flex gap-3">
                <AlertCircle className="text-danger shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-semibold text-danger">Next Semester Start Date Missing</h4>
                  <p className="text-sm text-danger mt-1">
                    The start date for the next semester is required to promote a student. Please configure it in the Academic Calendar settings first.
                  </p>
                </div>
              </div>
            )}

            {!hasNextStartDateError && isFutureEndDate && (
              <div className="bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-lg p-4 flex gap-3">
                <AlertTriangle className="text-warning shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-semibold text-warning">Current Semester Ends in the Future</h4>
                  <p className="text-sm text-warning mt-1">
                    The current semester has an end date of <strong>{formatDate(currentSemesterData?.endDate)}</strong>. 
                    You can choose to proceed anyway, or update the end date now.
                  </p>
                </div>
              </div>
            )}

            {!hasNextStartDateError && !isFutureEndDate && (
              <div className="bg-[var(--success-light)] border border-[var(--success-light)] rounded-lg p-4 flex gap-3">
                <CheckCircle2 className="text-success shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-semibold text-success">Ready for Promotion</h4>
                  <p className="text-sm text-success mt-1">
                    All academic calendar dates are properly configured. You can safely promote this student.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-background flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border-strong text-sub hover:bg-surface transition-colors text-sm font-medium"
          >
            Cancel
          </button>

          {!hasNextStartDateError && isFutureEndDate && (
            <button
              type="button"
              onClick={onUpdateEndDate}
              className="px-4 py-2 rounded-lg bg-surface border border-[var(--warning-light)] text-warning hover:bg-[var(--warning-light)] transition-colors text-sm font-medium"
            >
              Update End Date
            </button>
          )}

          <button
            type="button"
            disabled={hasNextStartDateError}
            onClick={onProceed}
            className={`px-4 py-2 rounded-lg text-white font-medium text-sm shadow transition-colors flex items-center gap-2
              ${hasNextStartDateError 
                ? 'bg-background cursor-not-allowed opacity-70'
                : 'bg-primary hover:bg-primary-hover'
              }`}
          >
            {isFutureEndDate ? 'Proceed Anyway' : 'Confirm Promotion'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromotionValidationModal;
