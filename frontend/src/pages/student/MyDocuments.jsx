import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  Calendar, 
  Info,
  ChevronRight,
  Loader2,
  Download,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { getCourseType, getCertificatesForCourse } from '../../config/certificateConfig';
import { formatDate } from '../../utils/dateUtils';

const MyDocuments = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submittedCerts, setSubmittedCerts] = useState([]);
  const [borrowHistory, setBorrowHistory] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);
  const [requestData, setRequestData] = useState({
    purpose: '',
    returnDate: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [certConfig, setCertConfig] = useState(null);

  const fetchDocumentData = async () => {
    try {
      setLoading(true);
      if (!user?.admission_number) return;

      const [submittedRes, historyRes, configRes] = await Promise.all([
        api.get(`/certificate-borrow/student/submitted-certificates/${user.admission_number}`),
        api.get(`/certificate-borrow/student/history/${user.admission_number}`),
        api.get('/settings/certificates').catch(() => null)
      ]);

      if (submittedRes.data.success) {
        setSubmittedCerts(submittedRes.data.data);
      }
      if (historyRes.data.success) {
        setBorrowHistory(historyRes.data.data);
      }
      if (configRes && configRes.data.success) {
        setCertConfig(configRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching document data:', error);
      toast.error('Failed to load document information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentData();
  }, [user]);

  const handleOpenRequest = (certKey, certLabel) => {
    // Check if there's already an active request for this certificate
    const activeRequest = borrowHistory.find(
      r => r.certificate_key === certKey && ['pending', 'approved', 'issued'].includes(r.status)
    );

    if (activeRequest) {
      toast.error('You already have an active request for this certificate');
      return;
    }

    setSelectedCert({ key: certKey, label: certLabel });
    setShowRequestModal(true);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!requestData.purpose || !requestData.returnDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post('/certificate-borrow/student/request', {
        admissionNumber: user.admission_number,
        certificateKey: selectedCert.key,
        certificateName: selectedCert.label,
        purpose: requestData.purpose,
        returnDate: requestData.returnDate
      });

      if (response.data.success) {
        toast.success('Borrow request submitted successfully');
        setShowRequestModal(false);
        setRequestData({ purpose: '', returnDate: '' });
        fetchDocumentData();
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="bg-[var(--warning-light)] text-warning px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Clock size={12} /> Pending</span>;
      case 'approved':
        return <span className="bg-[var(--primary-light)] text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle size={12} /> Approved</span>;
      case 'issued':
        return <span className="bg-[var(--primary-light)] text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><ShieldCheck size={12} /> Issued</span>;
      case 'returned':
        return <span className="bg-[var(--success-light)] text-success px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><RotateCcw size={12} /> Returned</span>;
      case 'rejected':
        return <span className="bg-[var(--danger-light)] text-danger px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><XCircle size={12} /> Rejected</span>;
      default:
        return <span className="bg-background text-sub px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit">{status}</span>;
    }
  };

  const courseType = getCourseType(user?.course_level || user?.course || '');
  
  // Use dynamic config if available, otherwise fallback to static config
  const configCerts = React.useMemo(() => {
    const rawCerts = (certConfig && certConfig[courseType.toLowerCase()]) || getCertificatesForCourse(courseType);
    return rawCerts.map(c => ({
      key: c.id || c.key,
      label: c.name || c.label
    }));
  }, [certConfig, courseType]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="bg-surface rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xs sm:shadow-sm border border-border flex items-center justify-between gap-3 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[var(--primary)] heading-font">My Documents</h1>
        </div>
        <div className="bg-[var(--primary-light)] py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-lg sm:rounded-xl flex items-center gap-2 sm:gap-2.5 border border-[var(--primary-light)]">
          <div className="p-1 sm:p-1.5 bg-primary text-white rounded-md sm:rounded-lg">
            <ShieldCheck size={14} className="sm:w-4 sm:h-4" />
          </div>
          <div className="leading-tight">
            <p className="text-[9px] sm:text-[10px] text-primary font-bold uppercase tracking-wider leading-none">Level</p>
            <p className="text-xs sm:text-sm font-bold text-primary leading-snug">{courseType || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Submitted Certificates */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-xl font-bold text-main flex items-center gap-2">
              <FileText className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
              Submitted Originals
            </h2>
            <div className="text-[10px] sm:text-xs font-medium text-muted-text bg-background px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">
              {submittedCerts.length} Documents Found
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 sm:h-28 bg-background animate-pulse rounded-lg sm:rounded-xl border border-border"></div>
              ))}
            </div>
          ) : submittedCerts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {configCerts
                .filter(c => submittedCerts.includes(c.key))
                .map(cert => (
                  <div key={cert.key} className="bg-surface p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl border border-border shadow-xs sm:shadow-sm hover:shadow-md transition-all group border-l-4 border-l-success">
                    <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                      <div className="p-1 sm:p-1.5 bg-[var(--success-light)] text-success rounded-md sm:rounded-lg group-hover:bg-success group-hover:text-white transition-colors">
                        <FileText size={14} className="sm:w-4 sm:h-4" />
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-bold text-success uppercase tracking-widest bg-[var(--success-light)] px-2 py-0.5 rounded-full">
                        Verified
                      </div>
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-main mb-2 sm:mb-2.5 line-clamp-1">{cert.label}</h3>
                    <button 
                      onClick={() => handleOpenRequest(cert.key, cert.label)}
                      className="w-full py-1 sm:py-1.5 bg-[var(--primary-light)] text-primary rounded-md sm:rounded-lg font-bold text-[11px] sm:text-xs hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-1"
                    >
                      Request Original <ArrowRight size={12} className="sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-background rounded-2xl p-6 sm:p-10 text-center border-2 border-dashed border-border">
              <FileText size={36} className="mx-auto text-muted-text mb-3 sm:w-12 sm:h-12" />
              <h3 className="text-base sm:text-lg font-bold text-sub">No original certificates submitted</h3>
              <p className="text-muted-text mt-1 max-w-xs mx-auto text-xs sm:text-sm">Once you submit your original documents to the office, they will appear here for borrowing requests.</p>
            </div>
          )}
        </div>

        {/* Info & Recent History */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-gradient-to-br from-primary to-secondary rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-sm shadow-primary">
            <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
              <div className="p-1 sm:p-1.5 bg-[var(--surface)]/20 rounded-md sm:rounded-lg backdrop-blur-sm">
                <Info size={14} className="sm:w-4 sm:h-4" />
              </div>
              <h3 className="font-bold text-xs sm:text-base">Borrowing Guidelines</h3>
            </div>
            <ul className="space-y-1.5 sm:space-y-2 text-[11px] sm:text-xs text-primary">
              <li className="flex items-start gap-1.5">
                <ChevronRight size={12} className="mt-0.5 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                Originals can be borrowed for valid purposes only.
              </li>
              <li className="flex items-start gap-1.5">
                <ChevronRight size={12} className="mt-0.5 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                Requests must specify a return date.
              </li>
              <li className="flex items-start gap-1.5">
                <ChevronRight size={12} className="mt-0.5 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                Late returns may affect future borrowing privileges.
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xs sm:text-base text-main">Recent Requests</h2>
            <button onClick={fetchDocumentData} className="text-primary text-[11px] sm:text-xs font-bold hover:underline">Refresh</button>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {borrowHistory.length > 0 ? (
              borrowHistory.slice(0, 5).map(request => (
                <div key={request.id} className="bg-surface p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border shadow-xs sm:shadow-sm">
                  <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                    <h4 className="font-bold text-xs sm:text-sm text-main line-clamp-1">{request.certificate_name}</h4>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-muted-text font-medium">
                    <Calendar size={11} className="sm:w-3 sm:h-3" />
                    <span>Req: {formatDate(request.request_date)}</span>
                    <span className="text-muted-text">|</span>
                    <span className={new Date(request.return_date) < new Date() && request.status === 'issued' ? 'text-danger font-bold' : ''}>
                      Return: {formatDate(request.return_date)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 sm:py-6 bg-background rounded-xl sm:rounded-2xl border border-border">
                <Clock size={24} className="mx-auto text-muted-text mb-1.5 sm:w-8 sm:h-8" />
                <p className="text-[11px] sm:text-xs text-muted-text">No recent requests</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-main">Request Original</h3>
                <p className="text-xs text-primary font-bold">{selectedCert?.label}</p>
              </div>
              <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-background rounded-full transition-colors text-muted-text">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-sub mb-2">Purpose of Borrowing</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="E.g., Passport verification, Job interview, etc."
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none outline-none text-sm"
                  value={requestData.purpose}
                  onChange={e => setRequestData({...requestData, purpose: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-sub mb-2">Return Date</label>
                <div className="relative">
                  <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-text" />
                  <input 
                    required
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm"
                    value={requestData.returnDate}
                    onChange={e => setRequestData({...requestData, returnDate: e.target.value})}
                  />
                </div>
                <p className="mt-2 text-[11px] text-warning flex items-center gap-1 font-medium">
                  <AlertCircle size={10} />
                  Please ensure to return the original by this date.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 py-3 border border-border text-sub rounded-xl font-bold hover:bg-background transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyDocuments;
