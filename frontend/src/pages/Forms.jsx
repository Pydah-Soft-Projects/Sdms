import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, QrCode, Eye, EyeOff, Download, Plus } from 'lucide-react';
import QRCodeComponent from 'react-qr-code';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

// Helper function to get the correct frontend URL for QR codes
const getFrontendUrl = () => {
  // In production, use the primary frontend URL
  if (import.meta.env.PROD) {
    return 'https://pydahsdbms.vercel.app';
  }
  // In development, use the current origin
  return window.location.origin;
};

const Forms = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const response = await api.get('/forms');
      setForms(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch forms');
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (formId, formName) => {
    if (!window.confirm(`Are you sure you want to delete "${formName}"?`)) {
      return;
    }

    try {
      await api.delete(`/forms/${formId}`);
      toast.success('Form deleted successfully');
      fetchForms();
    } catch (error) {
      toast.error('Failed to delete form');
    }
  };

  const handleToggleActive = async (formId, currentStatus) => {
    try {
      await api.put(`/forms/${formId}`, { isActive: !currentStatus });
      toast.success(`Form ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchForms();
    } catch (error) {
      toast.error('Failed to update form status');
    }
  };

  const handleShowQR = (form) => {
    setSelectedForm(form);
    setShowQRModal(true);
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code-svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');

      const downloadLink = document.createElement('a');
      downloadLink.download = `${selectedForm.form_name}-QR.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      toast.success('QR code downloaded successfully!');
    };

    img.onerror = () => {
      toast.error('Failed to generate QR code image');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={32}
            height={32}
            message="Loading forms..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary heading-font">Forms</h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1 sm:mt-2 body-font">Manage student registration forms</p>
        </div>
        <Link
          to="/forms/new"
          className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors touch-manipulation min-h-[44px] font-medium"
        >
          <Plus size={18} />
          Create Form
        </Link>
      </div>

      {forms.length === 0 ? (
        <div className="bg-card-bg rounded-xl shadow-sm border border-border-light p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="text-accent" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-2 heading-font">No forms available</h3>
            <p className="text-text-secondary body-font">Create your first student registration form to get started.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {forms.map((form) => (
            <div key={form.form_id} className="bg-card-bg rounded-lg sm:rounded-xl shadow-sm border border-border-light p-4 sm:p-6 card-hover">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary mb-1 heading-font">{form.form_name}</h3>
                  <p className="text-sm text-text-secondary line-clamp-2 body-font">{form.form_description || 'No description'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${form.is_active ? 'bg-success/10 text-success' : 'bg-border-light text-text-secondary'}`}>
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary body-font">Total Fields:</span>
                  <span className="font-medium text-text-primary">{form.form_fields?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary body-font">Active Fields:</span>
                  <span className="font-medium text-success">
                    {form.form_fields?.filter(field => field.isEnabled !== false).length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary body-font">Pending:</span>
                  <span className="font-medium text-warning">{form.pending_count || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary body-font">Approved:</span>
                  <span className="font-medium text-success">{form.approved_count || 0}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-border-light">
                  <div className="text-xs text-muted-text">
                    <div className="font-medium mb-1 body-font">Active Fields:</div>
                    <div className="space-y-1">
                      {form.form_fields
                        ?.filter(field => field.isEnabled !== false)
                        .map(field => (
                          <div key={field.id || field.label} className="flex items-center gap-2">
                            <span className="text-success-green">●</span>
                            <span className="text-body-dark">{field.label}</span>
                            {field.required && <span className="text-error-red text-xs">*</span>}
                          </div>
                        )) || 'None'}
                    </div>
                    {form.form_fields?.filter(field => field.isEnabled === false).length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium mb-1 text-muted-text body-font">Admin Fields:</div>
                        <div className="space-y-1">
                          {form.form_fields
                            ?.filter(field => field.isEnabled === false)
                            .map(field => (
                              <div key={field.id || field.label} className="flex items-center gap-2">
                                    <span className="text-muted-text">●</span>
                                    <span className="text-muted-text">{field.label} (Admin Only)</span>
                                  </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleShowQR(form)} className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 active:bg-primary/30 transition-colors touch-manipulation min-h-[44px] font-medium text-sm" title="View QR Code">
                  <QrCode size={16} />
                  <span className="hidden sm:inline">QR</span>
                </button>
                <Link to={`/forms/edit/${form.form_id}`} className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 bg-border-light text-text-primary rounded-lg hover:bg-accent/10 active:bg-accent/20 transition-colors touch-manipulation min-h-[44px] font-medium text-sm" title="Edit Form">
                  <Edit size={16} />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
                <button onClick={() => handleToggleActive(form.form_id, form.is_active)} className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 bg-border-light text-text-secondary rounded-lg hover:bg-accent/10 active:bg-accent/20 transition-colors touch-manipulation min-h-[44px]" title={form.is_active ? 'Deactivate' : 'Activate'}>
                  {form.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                  <span className="hidden sm:inline ml-1">{form.is_active ? 'Hide' : 'Show'}</span>
                </button>
                <button onClick={() => handleDelete(form.form_id, form.form_name)} className="px-3 py-2.5 sm:py-2 bg-[var(--danger-light)] text-danger rounded-lg hover:bg-[var(--danger-light)] active:bg-[var(--danger-light)] transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center" title="Delete Form">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showQRModal && selectedForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card-bg rounded-lg sm:rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6 my-auto">
            <h3 className="text-xl font-bold text-text-primary mb-4 heading-font">{selectedForm.form_name}</h3>
            <div className="bg-card-bg p-6 rounded-lg border-2 border-border-light mb-4 flex items-center justify-center">
              <QRCodeComponent
                id="qr-code-svg"
                value={`${getFrontendUrl()}/form/${selectedForm.form_id}`}
                size={256}
              />
            </div>
            <p className="text-sm text-text-secondary mb-4 text-center body-font">
              Scan this QR code to access the form
            </p>
            <div className="text-xs text-text-secondary text-center bg-background rounded-lg p-2 mb-4 font-mono break-all">
              {getFrontendUrl()}/form/{selectedForm.form_id}
            </div>
            <div className="text-xs text-text-secondary text-center mb-4">
              <p className="mb-2">If QR code doesn't work, copy and paste this URL:</p>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${getFrontendUrl()}/form/${selectedForm.form_id}`);
                    toast.success('URL copied to clipboard!');
                  } catch (error) {
                    // Fallback for browsers that don't support clipboard API
                    const textArea = document.createElement('textarea');
                    textArea.value = `${getFrontendUrl()}/form/${selectedForm.form_id}`;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    toast.success('URL copied to clipboard!');
                  }
                }}
                className="text-primary-600 hover:text-primary-700 underline"
              >
                Copy URL
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button onClick={downloadQRCode} className="flex-1 flex items-center justify-center gap-2 bg-secondary text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-secondary active:bg-secondary transition-colors touch-manipulation min-h-[44px] font-medium">
                <Download size={18} />
                Download
              </button>
              <button
                onClick={() => {
                  // Test the QR code URL
                  const testUrl = `${getFrontendUrl()}/form/${selectedForm.form_id}`;
                  window.open(testUrl, '_blank');
                  toast.success('Testing QR code URL in new tab');
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-success text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-success active:bg-success transition-colors touch-manipulation min-h-[44px] font-medium"
              >
                Test URL
              </button>
              <button onClick={() => setShowQRModal(false)} className="flex-1 bg-border-light text-text-primary px-4 py-2.5 sm:py-2 rounded-lg hover:bg-accent/10 active:bg-accent/20 transition-colors touch-manipulation min-h-[44px] font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Forms;
