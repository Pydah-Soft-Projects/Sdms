import React from 'react';
import { X, AlertTriangle, Users, ChevronDown, ChevronUp } from 'lucide-react';

const DeleteConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  itemName, 
  itemType,
  affectedStudents = [],
  totalStudentCount = 0,
  hasMoreStudents = false,
  isLoadingStudents = false
}) => {
  const [showStudentList, setShowStudentList] = React.useState(true);

  if (!isOpen) return null;

  const hasStudents = totalStudentCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Dim background */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-surface rounded-lg sm:rounded-xl shadow-2xl max-w-lg w-full transform transition-all max-h-[90vh] flex flex-col my-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 sm:top-4 right-3 sm:right-4 p-2 text-muted-text hover:text-sub active:text-sub transition-colors rounded-lg hover:bg-background active:bg-background z-10 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {/* Warning Icon */}
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[var(--danger-light)]">
              <AlertTriangle size={24} className="text-danger sm:w-8 sm:h-8" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg sm:text-xl font-bold text-main text-center mb-2">
            {title || 'Confirm Deletion'}
          </h3>

          {/* Warning Message */}
          <div className="mb-4 text-center">
            <p className="text-sm text-sub mb-2">
              <span className="font-semibold text-danger">Warning:</span> This action will permanently delete all students under this selection.
            </p>
            <p className="text-sm text-sub mb-2">
              This includes all linked {itemType === 'college' ? 'Courses, Branches, and Student records' : itemType === 'course' ? 'Branches and Student records' : 'Student records'}.
            </p>
            <p className="text-sm font-semibold text-danger">
              This action cannot be undone.
            </p>
            {itemName && (
              <p className="text-sm text-sub mt-3">
                <span className="font-medium">Item:</span> {itemName}
              </p>
            )}
          </div>

          {/* Affected Students Section */}
          {isLoadingStudents ? (
            <div className="mb-4 p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-sub">Loading affected students...</span>
              </div>
            </div>
          ) : hasStudents ? (
            <div className="mb-4">
              {/* Student count header */}
              <button
                onClick={() => setShowStudentList(!showStudentList)}
                className="w-full flex items-center justify-between p-3 bg-[var(--danger-light)] rounded-lg border border-[var(--danger-light)] hover:bg-[var(--danger-light)] active:bg-[var(--danger-light)] transition-colors touch-manipulation min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-danger" />
                  <span className="text-sm font-semibold text-danger">
                    {totalStudentCount} Student{totalStudentCount !== 1 ? 's' : ''} will be deleted
                  </span>
                </div>
                {showStudentList ? (
                  <ChevronUp size={18} className="text-danger" />
                ) : (
                  <ChevronDown size={18} className="text-danger" />
                )}
              </button>

              {/* Student list */}
              {showStudentList && affectedStudents.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface">
                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-2 p-2">
                    {affectedStudents.map((student, index) => (
                      <div key={student.admission_number || index} className="p-2 bg-background rounded border border-border">
                        <p className="text-xs font-medium text-main truncate" title={student.student_name}>
                          {student.student_name}
                        </p>
                        <p className="text-xs text-sub font-mono">{student.admission_number}</p>
                        <p className="text-xs text-muted-text">{student.batch || '-'}</p>
                      </div>
                    ))}
                    {hasMoreStudents && (
                      <div className="px-2 py-2 text-center text-xs text-muted-text bg-background border border-border rounded">
                        ... and {totalStudentCount - affectedStudents.length} more students
                      </div>
                    )}
                  </div>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block">
                    <table className="w-full text-xs">
                      <thead className="bg-background sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-sub">Admission No</th>
                          <th className="px-3 py-2 text-left font-medium text-sub">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-sub">Batch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {affectedStudents.map((student, index) => (
                          <tr key={student.admission_number || index} className="hover:bg-background">
                            <td className="px-3 py-2 text-sub font-mono">{student.admission_number}</td>
                            <td className="px-3 py-2 text-main truncate max-w-[150px]" title={student.student_name}>
                              {student.student_name}
                            </td>
                            <td className="px-3 py-2 text-sub">{student.batch || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {hasMoreStudents && (
                      <div className="px-3 py-2 text-center text-xs text-muted-text bg-background border-t border-border">
                        ... and {totalStudentCount - affectedStudents.length} more students
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4 p-3 bg-[var(--success-light)] rounded-lg border border-[var(--success-light)]">
              <p className="text-sm text-success text-center">
                ✓ No students will be affected by this deletion
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border-strong bg-surface text-sub font-medium hover:bg-background active:bg-background transition-colors touch-manipulation min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoadingStudents}
              className="flex-1 px-4 py-2.5 rounded-lg bg-danger text-white font-medium hover:bg-danger active:bg-danger transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
            >
              {hasStudents ? `Delete ${totalStudentCount} Student${totalStudentCount !== 1 ? 's' : ''}` : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
