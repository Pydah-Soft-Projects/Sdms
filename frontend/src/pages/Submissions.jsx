import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, Eye, Trash2, Filter, Upload, Plus, Hash, CheckSquare, Square, UserPlus, User, Phone, MapPin, GraduationCap, Calendar, FileText, X, QrCode, Link2, Copy, File, Image, FileCheck, FileX } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import BulkUploadModal from '../components/BulkUploadModal';
import IndividualStudentModal from '../components/IndividualStudentModal';
import LoadingAnimation from '../components/LoadingAnimation';
import { formatDate } from '../utils/dateUtils';

const Submissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showIndividualStudent, setShowIndividualStudent] = useState(false);
  const [showAdmissionSeries, setShowAdmissionSeries] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [formLink, setFormLink] = useState('');
  const [autoAssign, setAutoAssign] = useState(true); // Always enabled
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [fieldStatus, setFieldStatus] = useState(null);
  const [selectedSubmissions, setSelectedSubmissions] = useState(new Set());
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDeleteProgressModal, setShowDeleteProgressModal] = useState(false);
  const [deletingProgress, setDeletingProgress] = useState({ current: 0, total: 0, isDeleting: false });
  const [globalAutoAssign, setGlobalAutoAssign] = useState(true); // Always enabled
  const [approvedDocuments, setApprovedDocuments] = useState(new Set());
  const [expandedDocument, setExpandedDocument] = useState(null);
  const [s3Documents, setS3Documents] = useState({});

  useEffect(() => {
    setAutoAssign(true); // Always enabled
  }, []);

  useEffect(() => {
    fetchSubmissions();
    fetchForms();
    fetchAutoAssignStatus();
  }, [filter]);

  const fetchForms = async () => {
    setFormsLoading(true);
    try {
      const response = await api.get('/forms');
      const activeForms = response.data.data.filter(f => f.is_active);
      setForms(activeForms);
      
      // Generate form link for the first active form
      if (activeForms.length > 0) {
        const baseUrl = window.location.origin;
        setFormLink(`${baseUrl}/form/${activeForms[0].form_id}`);
      }
    } catch (error) {
      console.error('Failed to fetch forms');
      toast.error('Failed to load forms. Please refresh the page.');
    } finally {
      setFormsLoading(false);
    }
  };

  const fetchAutoAssignStatus = async () => {
    // Auto-assign is always enabled
    setGlobalAutoAssign(true);
  };

  const toggleGlobalAutoAssign = async () => {
    // Auto-assign is always enabled, cannot be toggled
    toast.info('Auto-assign is always enabled and cannot be disabled');
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/submissions?status=${filter}`);
      setSubmissions(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (submissionId) => {
    try {
      const response = await api.get(`/submissions/${submissionId}`);
      const submissionData = response.data.data;
      setSelectedSubmission(submissionData);
      setAdmissionNumber(submissionData.admission_number || '');

      // Initialize approved documents from submission data if available
      const submissionDataObj = submissionData.submission_data || {};
      const initialApproved = new Set();
      Object.keys(submissionDataObj).forEach(key => {
        // Check if document was already approved (stored in uploaded_documents or similar)
        if (submissionDataObj[key] && typeof submissionDataObj[key] === 'object' && submissionDataObj[key].approved) {
          initialApproved.add(key);
        }
      });
      setApprovedDocuments(initialApproved);
      setExpandedDocument(null);
      setS3Documents({});

      // If submission is approved, fetch student data to get S3 document links
      if (submissionData.status === 'approved' && submissionData.admission_number) {
        try {
          const studentResponse = await api.get(`/students/${submissionData.admission_number}`);
          const student = studentResponse.data.data;
          
          // Extract uploaded_documents from student_data (already parsed by backend)
          if (student && student.student_data) {
            const studentDataObj = student.student_data;
            
            if (studentDataObj.uploaded_documents && typeof studentDataObj.uploaded_documents === 'object') {
              setS3Documents(studentDataObj.uploaded_documents);
            }
          }
        } catch (error) {
          console.error('Failed to fetch student data for S3 documents:', error);
          // Non-fatal error, continue with base64 previews
        }
      }

      // Auto-generate admission number if auto-assign is enabled and no admission number exists
      if (globalAutoAssign && !submissionData.admission_number) {
        try {
          // Get the batch/academic year from submission data
          const batchYear = submissionData.submission_data?.batch || 
                           submissionData.submission_data?.academic_year ||
                           new Date().getFullYear().toString();
          
          const genResponse = await api.post('/submissions/generate-admission-series', { 
            autoAssign: true, // Always enabled
            academicYear: batchYear
          });
          setAdmissionNumber(genResponse.data.data.admissionNumbers[0]);
        } catch (error) {
          console.error('Failed to generate admission number:', error);
        }
      }

      setShowModal(true);
    } catch (error) {
      toast.error('Failed to fetch submission details');
    }
  };

  const handleApprove = async () => {
    if (!admissionNumber.trim()) {
      toast.error('Admission number is required');
      return;
    }

    try {
      console.log('Approving submission:', selectedSubmission.submission_id, 'with admission number:', admissionNumber.trim());

      await api.post(`/submissions/${selectedSubmission.submission_id}/approve`, {
        admissionNumber: admissionNumber.trim(),
      });

      toast.success('Submission approved successfully');
      setShowModal(false);
      setAdmissionNumber('');
      fetchSubmissions();
    } catch (error) {
      console.error('Approval error:', error);

      // Enhanced error handling for different types of errors
      let errorMessage = 'Failed to approve submission';

      if (error.response?.status === 500) {
        if (error.response?.data?.message?.includes('JSON')) {
          errorMessage = 'Data format error: Please check all form fields are properly filled.';
        } else {
          errorMessage = 'Server error: Please check the data format and try again.';
        }
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.message || 'Invalid data provided';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      // Log additional error details for debugging
      if (error.response?.data) {
        console.error('Error response data:', error.response.data);
      }

      toast.error(errorMessage);
    }
  };

  const handleReject = async () => {
    try {
      await api.post(`/submissions/${selectedSubmission.submission_id}/reject`, {
        reason: rejectionReason,
      });
      toast.success('Submission rejected');
      setShowModal(false);
      setRejectionReason('');
      fetchSubmissions();
    } catch (error) {
      toast.error('Failed to reject submission');
    }
  };

  const handleDelete = async (submissionId) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) {
      return;
    }

    try {
      await api.delete(`/submissions/${submissionId}`);
      toast.success('Submission deleted successfully');
      fetchSubmissions();
    } catch (error) {
      toast.error('Failed to delete submission');
    }
  };

  const handleSelectSubmission = (submissionId, isSelected) => {
    const newSelected = new Set(selectedSubmissions);
    if (isSelected) {
      newSelected.add(submissionId);
    } else {
      newSelected.delete(submissionId);
    }
    setSelectedSubmissions(newSelected);
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedSubmissions(new Set(submissions.map(s => s.submission_id)));
    } else {
      setSelectedSubmissions(new Set());
    }
  };

  const handleBulkApprove = async () => {
    if (selectedSubmissions.size === 0) {
      toast.error('Please select submissions to approve');
      return;
    }

    try {
      const response = await api.post('/submissions/bulk-approve', {
        submissionIds: Array.from(selectedSubmissions)
      });

      toast.success(`Successfully approved ${response.data.approvedCount} submissions`);
      setSelectedSubmissions(new Set());
      setShowBulkApproveModal(false);
      fetchSubmissions();
    } catch (error) {
      console.error('Bulk approval error:', error);
      toast.error(error.response?.data?.message || 'Failed to approve submissions');
    }
  };

  const handleBulkDelete = async () => {
    const submissionIds = Array.from(selectedSubmissions);
    if (submissionIds.length === 0) {
      toast.error('Please select submissions to delete');
      return;
    }

    try {
      // Use bulk delete endpoint for better performance
      const response = await api.post('/submissions/bulk-delete', {
        submissionIds: submissionIds
      });

      const { deletedCount, failedCount, errors } = response.data;

      if (deletedCount > 0) {
        toast.success(`Successfully deleted ${deletedCount} submission${deletedCount !== 1 ? 's' : ''}`);
      }
      if (failedCount > 0) {
        console.error('Failed deletions:', errors);
        toast.error(`Failed to delete ${failedCount} submission${failedCount !== 1 ? 's' : ''}`);
      }

      // Clear selection and refresh
      setSelectedSubmissions(new Set());
      setShowBulkDeleteModal(false);
      setShowDeleteProgressModal(false);
      setDeletingProgress({ current: 0, total: 0, isDeleting: false });
      fetchSubmissions();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete submissions');
      setShowDeleteProgressModal(false);
      setDeletingProgress({ current: 0, total: 0, isDeleting: false });
    }
  };

  

  const copyFormLink = () => {
    if (formLink) {
      navigator.clipboard.writeText(formLink);
      toast.success('Form link copied to clipboard!');
    } else {
      toast.error('No form link available');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-main">Self Registration</h1>
          <p className="text-sm sm:text-base text-sub mt-1 sm:mt-2">Manage student registrations and approvals</p>
          {selectedSubmissions.size > 0 && (
            <p className="text-xs sm:text-sm text-primary mt-1">
              {selectedSubmissions.size} submission{selectedSubmissions.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedSubmissions.size > 0 && (
            <button
            onClick={async () => {
              if (filter === 'pending') {
                setShowBulkApproveModal(true);
              } else {
                if (selectedSubmissions.size === 0) {
                  toast.error('Please select submissions to delete');
                  return;
                }
                setShowBulkDeleteModal(true);
              }
            }}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg transition-colors touch-manipulation min-h-[44px] text-sm font-medium ${
                filter === 'pending'
                  ? 'bg-success text-white hover:bg-success active:bg-success'
                  : 'bg-danger text-white hover:bg-danger active:bg-danger'
              }`}
            >
              {filter === 'pending' ? <CheckCircle size={18} /> : <Trash2 size={18} />}
              <span className="hidden sm:inline">{filter === 'pending'
                ? `Approve Selected (${selectedSubmissions.size})`
                : `Delete All Selected (${selectedSubmissions.size})`
              }</span>
              <span className="sm:hidden">{filter === 'pending' ? 'Approve' : 'Delete'}</span>
            </button>
          )}
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center justify-center gap-2 bg-primary text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:bg-primary-hover active:bg-primary transition-colors touch-manipulation min-h-[44px] text-sm font-medium"
            title="Show QR Code"
          >
            <QrCode size={18} />
            <span className="hidden sm:inline">QR Code</span>
          </button>
          <button
            onClick={copyFormLink}
            className="flex items-center justify-center gap-2 bg-primary text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:bg-primary-hover active:bg-primary transition-colors touch-manipulation min-h-[44px] text-sm font-medium"
            title="Copy Form Link"
          >
            <Copy size={18} />
            <span className="hidden sm:inline">Copy Link</span>
            <span className="sm:hidden">Link</span>
          </button>
          <button
            onClick={() => setShowIndividualStudent(true)}
            disabled={formsLoading || forms.length === 0}
            className="flex items-center justify-center gap-2 bg-secondary text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:bg-secondary active:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] text-sm font-medium"
            title={formsLoading ? 'Loading forms...' : forms.length === 0 ? 'No forms available' : 'Add a new student'}
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">{formsLoading ? 'Loading...' : 'Add Student'}</span>
            <span className="sm:hidden">Add</span>
          </button>
          <button
            onClick={() => setShowBulkUpload(true)}
            disabled={formsLoading || forms.length === 0}
            className="flex items-center justify-center gap-2 bg-success text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:bg-success active:bg-success transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] text-sm font-medium"
            title={formsLoading ? 'Loading forms...' : forms.length === 0 ? 'No forms available' : 'Upload students in bulk'}
          >
            <Upload size={18} />
            <span className="hidden sm:inline">{formsLoading ? 'Loading...' : 'Bulk Upload'}</span>
            <span className="sm:hidden">Upload</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 bg-surface rounded-lg p-1 border border-border w-full sm:w-fit">
          {['pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-300 ease-in-out transform touch-manipulation min-h-[44px]
                ${filter === status
                  ? 'bg-gradient-to-r from-success to-success text-white border-transparent shadow-md scale-105'
                  : 'text-sub bg-surface border-border-strong hover:bg-background active:bg-background hover:scale-105 hover:shadow-sm'}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="globalAutoAssign"
            checked={true}
            disabled={true}
            className="h-5 w-5 sm:h-4 sm:w-4 text-primary-600 focus:ring-primary-500 border-border-strong rounded cursor-not-allowed opacity-60"
          />
          <label htmlFor="globalAutoAssign" className="text-xs sm:text-sm font-medium text-sub">
            <span className="hidden sm:inline">Auto-Assign Series (Always On)</span>
            <span className="sm:hidden">Auto-Assign On</span>
          </label>
        </div>
      </div>


      {loading? (<div className="flex items-center justify-center">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={32}
            height={32}
            message="Loading submissions..."
          />
        </div>
      </div>):(
        <> 
        {submissions.length === 0 ? (
          <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="bg-background w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="text-muted-text" size={32} />
              </div>
              <h3 className="text-xl font-semibold text-main mb-2">No {filter} submissions</h3>
              <p className="text-sub">There are no {filter} submissions at the moment.</p>
            </div>
          </div>
        ) : (
          <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-surface rounded-lg sm:rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub w-12">
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.size === submissions.length && submissions.length > 0}
                        onChange={(e) => { e.stopPropagation(); handleSelectAll(e.target.checked); }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-border-strong rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Student Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Admission Number</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Pin Number</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Mobile Number</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Batch</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Branch</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Submitted By</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Submitted At</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-sub">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr
                      key={submission.submission_id}
                      onClick={() => handleViewDetails(submission.submission_id)}
                      className={`border-b border-border hover:bg-background ${
                        selectedSubmissions.has(submission.submission_id) ? 'bg-[var(--primary-light)]' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedSubmissions.has(submission.submission_id)}
                          onChange={(e) => { e.stopPropagation(); handleSelectSubmission(submission.submission_id, e.target.checked); }}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-border-strong rounded"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-main">{submission.submission_data['student_name'] || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-sub">{submission.admission_number || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-main">{submission.submission_data['pin_no'] || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-main">{submission.submission_data['student_mobile'] || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-main">{submission.submission_data['batch'] || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-main">{submission.submission_data['branch'] || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${submission.status === 'pending' ? 'bg-[var(--warning-light)] text-warning' : submission.status === 'approved' ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--danger-light)] text-danger'}`}>
                          {submission.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${submission.submitted_by === 'admin' ? 'bg-[var(--primary-light)] text-secondary' : 'bg-[var(--primary-light)] text-primary'}`}>
                          {submission.submitted_by === 'admin' ? '👤 Admin' : '🎓 Student'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-sub">{formatDate(submission.submitted_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {submission.status === 'pending' && (
                            <>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                if (submission.admission_number) {
                                  api.get(`/submissions/${submission.submission_id}`)
                                    .then(response => {
                                      const data = response.data.data;
                                      setSelectedSubmission(data);
                                      setAdmissionNumber(data.admission_number);
                                      // Directly approve using the fetched data
                                      api.post(`/submissions/${submission.submission_id}/approve`, {
                                        admissionNumber: data.admission_number,
                                      })
                                        .then(() => {
                                          toast.success('Submission approved successfully');
                                          fetchSubmissions();
                                        })
                                        .catch(error => {
                                          console.error('Approval error:', error);
                                          toast.error('Failed to approve submission');
                                        });
                                    })
                                    .catch(error => {
                                      toast.error('Failed to fetch submission details');
                                    });
                                } else {
                                  handleViewDetails(submission.submission_id);
                                }
                              }} className="p-2 text-success hover:bg-[var(--success-light)] rounded-lg transition-colors" title="Approve">
                                <CheckCircle size={16} />
                              </button>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(submission.submission_id);
                              }} className="p-2 text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors" title="Reject">
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          {(submission.status === 'rejected' || submission.status === 'approved') && (
                            <button onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(submission.submission_id);
                            }} className="p-2 text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          )}
                          <button onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(submission.submission_id);
                          }} className="p-2 text-primary hover:bg-[var(--primary-light)] rounded-lg transition-colors" title="View Details">
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {submissions.map((submission) => (
              <div
                key={submission.submission_id}
                className={`bg-surface border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow ${
                  selectedSubmissions.has(submission.submission_id) ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="p-4 space-y-3">
                  {/* Header with Checkbox */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.has(submission.submission_id)}
                        onChange={(e) => { e.stopPropagation(); handleSelectSubmission(submission.submission_id, e.target.checked); }}
                        className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-border-strong rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0" onClick={() => handleViewDetails(submission.submission_id)}>
                      <h3 className="font-semibold text-main text-base truncate">{submission.submission_data['student_name'] || 'N/A'}</h3>
                      <p className="text-sm text-sub mt-1">{submission.admission_number || 'N/A'}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                        submission.status === 'pending' ? 'bg-[var(--warning-light)] text-warning' :
                        submission.status === 'approved' ? 'bg-[var(--success-light)] text-success' :
                        'bg-[var(--danger-light)] text-danger'
                      }`}>
                        {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Key Information Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-text">PIN Number</p>
                      <p className="text-sm font-medium text-main">{submission.submission_data['pin_no'] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-text">Mobile</p>
                      <p className="text-sm font-medium text-main truncate" title={submission.submission_data['student_mobile'] || ''}>{submission.submission_data['student_mobile'] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-text">Batch</p>
                      <p className="text-sm font-medium text-main">{submission.submission_data['batch'] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-text">Branch</p>
                      <p className="text-sm font-medium text-main truncate" title={submission.submission_data['branch'] || ''}>{submission.submission_data['branch'] || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-text">Submitted</p>
                      <p className="text-sm font-medium text-main">{formatDate(submission.submitted_at)}</p>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                    {submission.status === 'pending' && (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (submission.admission_number) {
                              api.get(`/submissions/${submission.submission_id}`)
                                .then(response => {
                                  const data = response.data.data;
                                  setSelectedSubmission(data);
                                  setAdmissionNumber(data.admission_number);
                                  api.post(`/submissions/${submission.submission_id}/approve`, {
                                    admissionNumber: data.admission_number,
                                  })
                                    .then(() => {
                                      toast.success('Submission approved successfully');
                                      fetchSubmissions();
                                    })
                                    .catch(error => {
                                      console.error('Approval error:', error);
                                      toast.error('Failed to approve submission');
                                    });
                                })
                                .catch(error => {
                                  toast.error('Failed to fetch submission details');
                                });
                            } else {
                              handleViewDetails(submission.submission_id);
                            }
                          }} 
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-success text-white rounded-lg hover:bg-success active:bg-success transition-colors touch-manipulation min-h-[44px] text-sm font-medium"
                          title="Approve"
                        >
                          <CheckCircle size={16} />
                          Approve
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(submission.submission_id);
                          }} 
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-danger text-white rounded-lg hover:bg-danger active:bg-danger transition-colors touch-manipulation min-h-[44px] text-sm font-medium"
                          title="Reject"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </>
                    )}
                    {(submission.status === 'rejected' || submission.status === 'approved') && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(submission.submission_id);
                        }} 
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-danger text-white rounded-lg hover:bg-danger active:bg-danger transition-colors touch-manipulation min-h-[44px] text-sm font-medium"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(submission.submission_id);
                      }} 
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover active:bg-primary transition-colors touch-manipulation min-h-[44px] text-sm font-medium"
                      title="View Details"
                    >
                      <Eye size={16} />
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </>)}

      {showModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-background rounded-lg sm:rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col my-auto">
            {/* Header */}
            <div className="bg-surface border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 rounded-t-lg sm:rounded-t-xl">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-main">Student Submission Details</h3>
                <p className="text-xs sm:text-sm text-muted-text mt-1">Review and approve student submission</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                  selectedSubmission.status === 'pending' ? 'bg-[var(--warning-light)] text-warning' :
                  selectedSubmission.status === 'approved' ? 'bg-[var(--success-light)] text-success' :
                  'bg-[var(--danger-light)] text-danger'
                }`}>
                  {selectedSubmission.status.charAt(0).toUpperCase() + selectedSubmission.status.slice(1)}
                </span>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-background active:bg-background rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="flex-1 overflow-hidden">
              <div className="flex flex-col lg:flex-row h-full">
                {/* Left Sidebar - Student Photo & Key Info */}
                <div className="w-full lg:w-80 bg-surface border-b lg:border-b-0 lg:border-r border-border p-4 sm:p-6 flex-shrink-0 flex flex-col overflow-y-auto max-h-[40vh] lg:max-h-none">
                  <div className="space-y-5">
                    {/* Student Photo */}
                    <div className="flex flex-col items-center">
                      <div className="w-32 h-32 rounded-xl bg-background border-2 border-border overflow-hidden flex items-center justify-center shadow-sm">
                        {selectedSubmission.submission_data.student_photo ? (
                          <img
                            src={selectedSubmission.submission_data.student_photo}
                            alt="Student Photo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-center">
                            <User size={48} className="mx-auto text-muted-text mb-1" />
                            <span className="text-xs text-muted-text">No Photo</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Key Identity Info */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                          Student Name
                        </label>
                        <p className="text-lg font-bold text-main">
                          {selectedSubmission.submission_data.student_name || selectedSubmission.submission_data['Student Name'] || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                          Father Name
                        </label>
                        <p className="text-sm font-semibold text-sub">
                          {selectedSubmission.submission_data.father_name || selectedSubmission.submission_data['Father Name'] || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                          College
                        </label>
                        <p className="text-sm font-semibold text-sub">
                          {selectedSubmission.submission_data.college || selectedSubmission.submission_data['College'] || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                          Program & Branch
                        </label>
                        <p className="text-sm font-semibold text-sub">
                          {selectedSubmission.submission_data.course || '-'} - {selectedSubmission.submission_data.branch || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                          Batch
                        </label>
                        <p className="text-sm font-semibold text-primary">
                          {selectedSubmission.submission_data.batch || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                          Submitted At
                        </label>
                        <p className="text-sm text-sub">
                          {formatDate(selectedSubmission.submitted_at)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                          Submitted By
                        </label>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          selectedSubmission.submitted_by === 'admin' ? 'bg-[var(--primary-light)] text-secondary' : 'bg-[var(--primary-light)] text-primary'
                        }`}>
                          {selectedSubmission.submitted_by === 'admin' ? '👤 Admin' : '🎓 Student'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - All Student Data */}
                <div className="flex-1 p-6 overflow-y-auto max-h-[calc(95vh-200px)]">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Academic Information */}
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-main mb-3 flex items-center gap-2">
                        <GraduationCap size={16} className="text-primary" />
                        Academic Information
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-muted-text mb-1">Current Year</label>
                            <p className="text-sm font-semibold text-main">
                              Year {selectedSubmission.submission_data.current_year || selectedSubmission.submission_data['Current Academic Year'] || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-text mb-1">Semester</label>
                            <p className="text-sm font-semibold text-main">
                              Sem {selectedSubmission.submission_data.current_semester || selectedSubmission.submission_data['Current Semester'] || '-'}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Student Type</label>
                          <p className="text-sm font-semibold text-main">
                            {selectedSubmission.submission_data.stud_type || selectedSubmission.submission_data['StudType'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Student Status</label>
                          <p className="text-sm font-semibold text-main">
                            {selectedSubmission.submission_data.student_status || selectedSubmission.submission_data['Student Status'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Scholar Status</label>
                          <p className="text-sm font-semibold text-main">
                            {selectedSubmission.submission_data.scholar_status || selectedSubmission.submission_data['Scholar Status'] || 'Pending'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Previous College</label>
                          <p className="text-sm text-main">
                            {selectedSubmission.submission_data.previous_college || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-main mb-3 flex items-center gap-2">
                        <Phone size={16} className="text-success" />
                        Contact Information
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Student Mobile</label>
                          <p className="text-sm font-semibold text-main">
                            {selectedSubmission.submission_data.student_mobile || selectedSubmission.submission_data['Student Mobile Number'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Parent Mobile 1</label>
                          <p className="text-sm font-semibold text-main">
                            {selectedSubmission.submission_data.parent_mobile1 || selectedSubmission.submission_data['Parent Mobile Number 1'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Parent Mobile 2</label>
                          <p className="text-sm text-main">
                            {selectedSubmission.submission_data.parent_mobile2 || selectedSubmission.submission_data['Parent Mobile Number 2'] || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Personal Information */}
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-main mb-3 flex items-center gap-2">
                        <User size={16} className="text-secondary" />
                        Personal Information
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-muted-text mb-1">Gender</label>
                            <p className="text-sm font-semibold text-main">
                              {selectedSubmission.submission_data.gender === 'M' ? 'Male' : 
                               selectedSubmission.submission_data.gender === 'F' ? 'Female' : 
                               selectedSubmission.submission_data.gender || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-text mb-1">Date of Birth</label>
                            <p className="text-sm font-semibold text-main">
                              {selectedSubmission.submission_data.dob || '-'}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Caste</label>
                          <p className="text-sm font-semibold text-main">
                            {selectedSubmission.submission_data.caste || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Aadhaar Number</label>
                          <p className="text-sm text-main">
                            {selectedSubmission.submission_data.adhar_no || selectedSubmission.submission_data['AADHAR No'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">PIN Number</label>
                          <p className="text-sm font-semibold text-main">
                            {selectedSubmission.submission_data.pin_no || selectedSubmission.submission_data['Pin Number'] || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-main mb-3 flex items-center gap-2">
                        <MapPin size={16} className="text-danger" />
                        Address Information
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Address</label>
                          <p className="text-sm text-main">
                            {selectedSubmission.submission_data.student_address || selectedSubmission.submission_data['Student Address'] || '-'}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-muted-text mb-1">City/Village</label>
                            <p className="text-sm text-main">
                              {selectedSubmission.submission_data.city_village || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-text mb-1">Mandal</label>
                            <p className="text-sm text-main">
                              {selectedSubmission.submission_data.mandal_name || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-text mb-1">District</label>
                            <p className="text-sm text-main">
                              {selectedSubmission.submission_data.district || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Information */}
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-4 col-span-2">
                      <h4 className="text-sm font-semibold text-main mb-3 flex items-center gap-2">
                        <FileText size={16} className="text-warning" />
                        Additional Information
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-muted-text mb-1">Certificates Status</label>
                          <p className="text-sm font-semibold text-main">
                            {selectedSubmission.submission_data.certificates_status || '-'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-muted-text mb-1">Remarks</label>
                          <p className="text-sm text-main">
                            {selectedSubmission.submission_data.remarks || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Documents Section */}
                    {(() => {
                      // Extract documents from submission_data or Google Drive
                      const submissionData = selectedSubmission.submission_data || {};
                      const documents = [];
                      const isApproved = selectedSubmission.status === 'approved';
                      
                      // First, collect all document keys from submission_data
                      const documentKeys = new Set();
                      Object.entries(submissionData).forEach(([key, value]) => {
                        if (typeof value === 'string' && (
                          value.startsWith('data:') || // Base64 data URL
                          key.toLowerCase().includes('document') ||
                          key.toLowerCase().startsWith('document_')
                        )) {
                          documentKeys.add(key);
                        }
                      });
                      
                      // Also check S3 documents if approved
                      if (isApproved && s3Documents) {
                        Object.keys(s3Documents).forEach(key => {
                          documentKeys.add(key);
                        });
                      }
                      
                      // Build documents array with priority: S3 > Base64
                      documentKeys.forEach(key => {
                        let docName = key.replace(/^document_/i, '').replace(/_/g, ' ');
                        if (!docName || docName === key) {
                          docName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        }
                        
                        // Check if we have S3 link (for approved submissions)
                        const s3Doc = s3Documents[key];
                        let docData = null;
                        let isImage = false;
                        let isPdf = false;
                        let isS3 = false;
                        let webViewLink = null;
                        let fileName = docName;
                        
                        if (isApproved && s3Doc && s3Doc.webViewLink) {
                          // Use S3 link
                          isS3 = true;
                          webViewLink = s3Doc.webViewLink;
                          fileName = s3Doc.fileName || docName;
                          
                          // Determine file type from fileName or MIME type
                          const fileExt = fileName.toLowerCase().split('.').pop();
                          isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                          isPdf = fileExt === 'pdf' || fileName.toLowerCase().includes('pdf');
                          
                          // For images, use S3 URL directly
                          if (isImage) {
                            docData = webViewLink;
                          } else {
                            docData = webViewLink;
                          }
                        } else {
                          // Use base64 data from submission_data
                          const base64Value = submissionData[key];
                          if (base64Value && typeof base64Value === 'string' && base64Value.startsWith('data:')) {
                            docData = base64Value;
                            isImage = base64Value.startsWith('data:image/');
                            isPdf = base64Value.startsWith('data:application/pdf');
                          }
                        }
                        
                        if (docData) {
                          documents.push({
                            key,
                            name: docName,
                            fileName: fileName,
                            data: docData,
                            webViewLink: webViewLink,
                            isImage,
                            isPdf,
                            isS3
                          });
                        }
                      });

                      if (documents.length === 0) {
                        return null;
                      }

                      return (
                        <div className="bg-surface rounded-xl border border-border shadow-sm p-4 col-span-2">
                          <h4 className="text-sm font-semibold text-main mb-3 flex items-center gap-2">
                            <FileText size={16} className="text-primary" />
                            Uploaded Documents ({documents.length})
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {documents.map((doc, index) => {
                              const isApproved = approvedDocuments.has(doc.key);
                              const isExpanded = expandedDocument === doc.key;
                              
                              return (
                                <div
                                  key={index}
                                  className={`border-2 rounded-lg p-3 transition-all ${
                                    isApproved
                                      ? 'border-success bg-[var(--success-light)]'
                                      : 'border-border bg-surface hover:border-[var(--primary-light)]'
                                  }`}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isApproved}
                                        onChange={(e) => {
                                          const newApproved = new Set(approvedDocuments);
                                          if (e.target.checked) {
                                            newApproved.add(doc.key);
                                          } else {
                                            newApproved.delete(doc.key);
                                          }
                                          setApprovedDocuments(newApproved);
                                        }}
                                        className="h-4 w-4 text-success focus:ring-success border-border-strong rounded flex-shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span className="text-xs font-medium text-sub truncate" title={doc.name}>
                                        {doc.name}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Document Preview */}
                                  <div
                                    className="relative cursor-pointer group"
                                    onClick={() => setExpandedDocument(isExpanded ? null : doc.key)}
                                  >
                                    {doc.isImage ? (
                                      <div className="relative w-full aspect-square bg-background rounded overflow-hidden">
                                        <img
                                          src={doc.data}
                                          alt={doc.name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                        <div className="hidden absolute inset-0 items-center justify-center bg-background">
                                          <Image size={24} className="text-muted-text" />
                                        </div>
                                        {isExpanded && (
                                          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10">
                                            <div className="relative max-w-full max-h-full">
                                              <img
                                                src={doc.data}
                                                alt={doc.name}
                                                className="max-w-full max-h-[90vh] object-contain"
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                              {doc.isS3 && doc.webViewLink && (
                                                <a
                                                  href={doc.webViewLink}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium flex items-center gap-2"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <Link2 size={16} />
                                                  Open Document
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-full aspect-square bg-background rounded flex flex-col items-center justify-center p-4 relative">
                                        <File size={32} className="text-muted-text mb-2" />
                                        <span className="text-xs text-sub text-center line-clamp-2">{doc.fileName || doc.name}</span>
                                        {doc.isS3 && (
                                          <div className="absolute top-2 right-2 bg-[var(--success-light)] text-success text-[10px] px-2 py-0.5 rounded-full font-medium">
                                            S3
                                          </div>
                                        )}
                                        {isExpanded && (
                                          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10 rounded">
                                            <div className="bg-surface rounded-lg p-4 max-w-md max-h-[80vh] overflow-auto">
                                              <p className="text-sm font-semibold text-main mb-2">Document: {doc.fileName || doc.name}</p>
                                              {doc.isS3 && doc.webViewLink ? (
                                                <a
                                                  href={doc.webViewLink}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <Link2 size={16} />
                                                  Open Document
                                                </a>
                                              ) : (
                                                <a
                                                  href={doc.data}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-primary hover:underline text-sm"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  Open in new tab
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                      <Eye size={20} className="text-white" />
                                    </div>
                                  </div>
                                  
                                  {/* Approval Status Badge */}
                                  {isApproved && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-success">
                                      <FileCheck size={12} />
                                      <span>Approved</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Approval Actions */}
            <div className="bg-surface border-t border-border px-6 py-4 flex-shrink-0 rounded-b-xl">
              {selectedSubmission.status === 'pending' ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1 max-w-md">
                      <label className="block text-sm font-medium text-sub mb-1">
                        Admission Number <span className="text-danger">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={admissionNumber} 
                        onChange={(e) => setAdmissionNumber(e.target.value)} 
                        className="w-full px-4 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-success focus:border-transparent outline-none"
                        placeholder="Enter admission number to approve" 
                      />
                    </div>
                    <div className="flex-1 max-w-md">
                      <label className="block text-sm font-medium text-sub mb-1">
                        Rejection Reason (optional)
                      </label>
                      <input 
                        type="text" 
                        value={rejectionReason} 
                        onChange={(e) => setRejectionReason(e.target.value)} 
                        className="w-full px-4 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-danger focus:border-transparent outline-none"
                        placeholder="Enter reason if rejecting" 
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <button 
                      onClick={handleApprove} 
                      className="flex items-center gap-2 bg-success text-white px-6 py-2.5 rounded-lg hover:bg-success transition-colors font-medium shadow-sm"
                    >
                      <CheckCircle size={18} />
                      Approve & Add to Database
                    </button>
                    <button 
                      onClick={handleReject} 
                      className="flex items-center gap-2 bg-danger text-white px-6 py-2.5 rounded-lg hover:bg-danger transition-colors font-medium shadow-sm"
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                    <button 
                      onClick={() => setShowModal(false)} 
                      className="px-4 py-2.5 border border-border-strong text-sub rounded-lg hover:bg-background transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="px-6 py-2.5 border border-border-strong text-sub rounded-lg hover:bg-background transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        forms={forms}
        isLoadingForms={formsLoading}
        onUploadComplete={fetchSubmissions}
      />

      <IndividualStudentModal
        isOpen={showIndividualStudent}
        onClose={() => setShowIndividualStudent(false)}
        forms={forms}
        isLoadingForms={formsLoading}
        onSubmitComplete={fetchSubmissions}
      />

      {/* Bulk Approve Modal */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-main mb-4">Bulk Approve Submissions</h3>

            <div className="mb-6">
              <p className="text-sub mb-2">
                You are about to approve <strong>{selectedSubmissions.size}</strong> submission{selectedSubmissions.size !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-muted-text">
                Each submission will need an admission number assigned during the approval process.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleBulkApprove}
                className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded-lg hover:bg-success transition-colors"
              >
                <CheckCircle size={18} />
                Approve All Selected
              </button>
              <button
                onClick={() => setShowBulkApproveModal(false)}
                className="px-4 py-2 border border-border-strong text-sub rounded-lg hover:bg-background transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-main mb-4">Bulk Delete Submissions</h3>

            <div className="mb-6">
              <p className="text-sub mb-2">
                You are about to delete <strong>{selectedSubmissions.size}</strong> submission{selectedSubmissions.size !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-muted-text">
                This action cannot be undone. All selected submissions will be permanently removed.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setShowBulkDeleteModal(false);
                  await handleBulkDelete();
                }}
                className="flex items-center gap-2 bg-danger text-white px-4 py-2 rounded-lg hover:bg-danger transition-colors"
              >
                <Trash2 size={18} />
                Delete All Selected
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 border border-border-strong text-sub rounded-lg hover:bg-background transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Progress Modal */}
      {showDeleteProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-main mb-4">Deleting Submissions</h3>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-sub">
                  Deleting {deletingProgress.current}/{deletingProgress.total}
                </span>
                <span className="text-sm text-muted-text">
                  {Math.round((deletingProgress.current / deletingProgress.total) * 100)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-background rounded-full h-3 mb-4 relative overflow-hidden">
                <div
                  className="progress-shimmer h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(deletingProgress.current / deletingProgress.total) * 100}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-[var(--primary-light)] border-t-primary"></div>
                <span className="ml-2 text-sub">Processing...</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setDeletingProgress(prev => ({ ...prev, isDeleting: false }));
                  setShowDeleteProgressModal(false);
                  toast.info('Deletion cancelled');
                }}
                className="flex-1 px-4 py-2 border border-border-strong text-sub rounded-lg hover:bg-background transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-main">Registration Form QR Code</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="text-center">
              <p className="text-sub mb-4">
                Scan this QR code to access the student registration form
              </p>
              
              {formLink && (
                <div className="bg-surface p-4 rounded-xl border-2 border-border inline-block mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(formLink)}`}
                    alt="Registration Form QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
              )}

              <div className="bg-background rounded-lg p-3 mb-4">
                <p className="text-xs text-muted-text mb-1">Form Link:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formLink}
                    readOnly
                    className="flex-1 text-sm text-sub bg-surface border border-border-strong rounded px-3 py-2 outline-none"
                  />
                  <button
                    onClick={copyFormLink}
                    className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                    title="Copy Link"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => {
                    window.open(formLink, '_blank');
                  }}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
                >
                  <Link2 size={18} />
                  Open Form
                </button>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="px-4 py-2 border border-border-strong text-sub rounded-lg hover:bg-background transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Submissions;
