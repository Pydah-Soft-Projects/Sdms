import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../config/api';

const UpdateSemesterEndDateModal = ({ isOpen, onClose, semesterData, onUpdated }) => {
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && semesterData?.endDate) {
      try {
        const d = new Date(semesterData.endDate);
        if (!isNaN(d.getTime())) {
          setEndDate(d.toISOString().split('T')[0]);
        }
      } catch (e) {
        // Ignore
      }
    }
  }, [isOpen, semesterData]);

  if (!isOpen || !semesterData) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!endDate) {
      toast.error('Please select an end date');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.put(`/semesters/${semesterData.id}`, {
        endDate
      });
      if (response.data?.success) {
        toast.success('Semester end date updated successfully');
        onUpdated?.(response.data.data);
        onClose();
      } else {
        toast.error(response.data?.message || 'Failed to update end date');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update end date');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--warning-light)]">
          <div>
            <h2 className="text-lg font-bold text-warning flex items-center gap-2">
              <Calendar size={18} className="text-warning" />
              Update Semester End Date
            </h2>
            <p className="text-xs text-warning mt-1">
              Required for promotion: Year {semesterData.yearOfStudy} • Semester {semesterData.semesterNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--warning-light)] text-warning transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4 text-sm text-sub bg-[var(--warning-light)] p-3 rounded-lg border border-[var(--warning-light)]">
            <strong>Warning:</strong> You are trying to promote a student, but their current semester's end date is in the future. Please update the end date to today or a past date to proceed.
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-sub mb-1">
                New End Date <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]} // Max date is today
                className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-warning focus:border-warning"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-sub bg-surface border border-border-strong rounded-lg hover:bg-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-warning"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-warning border border-transparent rounded-lg hover:bg-warning focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-warning disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Update End Date
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateSemesterEndDateModal;
