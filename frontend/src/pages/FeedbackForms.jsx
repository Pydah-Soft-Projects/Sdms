import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, QrCode, Eye, EyeOff, Download, Plus, Calendar, BarChart3, Users, MessageSquare, TrendingUp } from 'lucide-react';
import QRCodeComponent from 'react-qr-code';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

// Helper function to get the correct frontend URL for QR codes
const getFrontendUrl = () => {
    if (import.meta.env.PROD) {
        return 'https://pydahsdbms.vercel.app';
    }
    return window.location.origin;
};

const FeedbackForms = () => {
    const [activeTab, setActiveTab] = useState('forms'); // 'forms' or 'analytics'
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedForm, setSelectedForm] = useState(null);
    const [showQRModal, setShowQRModal] = useState(false);

    // Analytics state
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [filters, setFilters] = useState({
        formId: '',
        year: '',
        semester: '',
        course: '',
        branch: ''
    });

    useEffect(() => {
        fetchForms();
    }, []);

    useEffect(() => {
        if (activeTab === 'analytics' && filters.formId) {
            fetchAnalytics();
        }
    }, [activeTab, filters]);

    const fetchForms = async () => {
        try {
            const response = await api.get('/feedback-forms');
            setForms(response.data.data);
            if (response.data.data.length > 0 && !filters.formId) {
                setFilters(prev => ({ ...prev, formId: response.data.data[0].form_id }));
            }
        } catch (error) {
            toast.error('Failed to fetch feedback forms');
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        if (!filters.formId) return;

        try {
            setAnalyticsLoading(true);
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });

            const response = await api.get(`/feedback-forms/analytics?${params.toString()}`);
            setAnalyticsData(response.data.data);
        } catch (error) {
            toast.error('Failed to fetch analytics');
            console.error(error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleDelete = async (formId, formName) => {
        if (!window.confirm(`Are you sure you want to delete "${formName}"?`)) {
            return;
        }

        try {
            await api.delete(`/feedback-forms/${formId}`);
            toast.success('Form deleted successfully');
            fetchForms();
        } catch (error) {
            toast.error('Failed to delete form');
        }
    };

    const handleToggleActive = async (formId, currentStatus) => {
        try {
            await api.put(`/feedback-forms/${formId}`, { isActive: !currentStatus });
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

    const exportAnalytics = () => {
        if (!analyticsData) return;

        // Create CSV content
        let csv = 'Subject,Faculty,Response Count,Average Rating,Remarks\n';

        analyticsData.subjectBreakdown?.forEach(item => {
            csv += `"${item.subjectName}","${item.facultyName}",${item.responseCount},${item.averageRating || 'N/A'},"${item.remarks || ''}"\n`;
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feedback-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast.success('Analytics exported successfully!');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingAnimation width={32} height={32} message="Loading feedback forms..." />
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-main heading-font">Feedback Application</h1>
                    <p className="text-sm sm:text-base text-sub mt-1 sm:mt-2 body-font">Manage feedback forms and analyze responses</p>
                </div>
                <Link
                    to="/feedback-forms/new"
                    className="flex items-center justify-center gap-2 bg-sidebar text-white px-4 py-2.5 rounded-lg hover:bg-sidebar transition-colors min-h-[44px] font-medium shadow-lg"
                >
                    <Plus size={18} />
                    Create Feedback Form
                </Link>
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('forms')}
                        className={`pb-3 px-1 border-b-2 font-medium transition-colors ${activeTab === 'forms'
                                ? 'border-border-strong text-main'
                                : 'border-transparent text-muted-text hover:text-sub'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <MessageSquare size={18} />
                            Forms
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`pb-3 px-1 border-b-2 font-medium transition-colors ${activeTab === 'analytics'
                                ? 'border-border-strong text-main'
                                : 'border-transparent text-muted-text hover:text-sub'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <BarChart3 size={18} />
                            Response Analytics
                        </div>
                    </button>
                </div>
            </div>

            {/* Forms Tab */}
            {activeTab === 'forms' && (
                <>
                    {forms.length === 0 ? (
                        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
                            <div className="max-w-md mx-auto">
                                <div className="bg-[var(--primary-light)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <QrCode className="text-primary" size={32} />
                                </div>
                                <h3 className="text-xl font-semibold text-main mb-2 heading-font">No feedback forms available</h3>
                                <p className="text-sub body-font">Create your first feedback form to get started.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {forms.map((form) => (
                                <div key={form.form_id} className="bg-surface rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-main mb-1 heading-font">{form.form_name}</h3>
                                            <p className="text-sm text-sub line-clamp-2 body-font">{form.form_description || 'No description'}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${form.is_active ? 'bg-[var(--success-light)] text-success' : 'bg-background text-sub'}`}>
                                            {form.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    {form.recurrence_config && JSON.parse(form.recurrence_config).enabled && (
                                        <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--primary-light)] text-primary text-xs font-medium border border-[var(--primary-light)]">
                                            <Calendar size={14} />
                                            <span>
                                                Resends {JSON.parse(form.recurrence_config).frequency}
                                                {JSON.parse(form.recurrence_config).interval > 1 ? ` (Every ${JSON.parse(form.recurrence_config).interval})` : ''}
                                            </span>
                                        </div>
                                    )}

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-sub body-font">Total Fields:</span>
                                            <span className="font-medium text-main">{form.form_fields?.length || 0}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button onClick={() => handleShowQR(form)} className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-2 bg-[var(--primary-light)] text-primary rounded-lg hover:bg-[var(--primary-light)] transition-colors min-h-[44px] font-medium text-sm">
                                            <QrCode size={16} />
                                            <span className="hidden sm:inline">QR</span>
                                        </button>
                                        <Link to={`/feedback-forms/edit/${form.form_id}`} className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-2 bg-background text-sub rounded-lg hover:bg-background transition-colors min-h-[44px] font-medium text-sm">
                                            <Edit size={16} />
                                            <span className="hidden sm:inline">Edit</span>
                                        </Link>
                                        <button onClick={() => handleToggleActive(form.form_id, form.is_active)} className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-2 bg-background text-sub rounded-lg hover:bg-background transition-colors min-h-[44px]">
                                            {form.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                                            <span className="hidden sm:inline ml-1">{form.is_active ? 'Hide' : 'Show'}</span>
                                        </button>
                                        <button onClick={() => handleDelete(form.form_id, form.form_name)} className="px-3 py-2 bg-[var(--danger-light)] text-danger rounded-lg hover:bg-[var(--danger-light)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    {/* Filters */}
                    <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
                        <h3 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
                            <BarChart3 size={20} />
                            Filters
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-sub mb-2">Feedback Form</label>
                                <select
                                    value={filters.formId}
                                    onChange={(e) => setFilters({ ...filters, formId: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="">Select Form</option>
                                    {forms.map(form => (
                                        <option key={form.form_id} value={form.form_id}>{form.form_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sub mb-2">Year</label>
                                <select
                                    value={filters.year}
                                    onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="">All Years</option>
                                    <option value="1">1st Year</option>
                                    <option value="2">2nd Year</option>
                                    <option value="3">3rd Year</option>
                                    <option value="4">4th Year</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sub mb-2">Semester</label>
                                <select
                                    value={filters.semester}
                                    onChange={(e) => setFilters({ ...filters, semester: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="">All Semesters</option>
                                    <option value="1">Semester 1</option>
                                    <option value="2">Semester 2</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sub mb-2">Course</label>
                                <select
                                    value={filters.course}
                                    onChange={(e) => setFilters({ ...filters, course: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="">All Courses</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sub mb-2">Branch</label>
                                <select
                                    value={filters.branch}
                                    onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="">All Branches</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={exportAnalytics}
                                disabled={!analyticsData}
                                className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Download size={16} />
                                Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    {analyticsLoading ? (
                        <div className="flex justify-center py-12">
                            <LoadingAnimation width={24} height={24} message="Loading analytics..." />
                        </div>
                    ) : analyticsData ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-gradient-to-br from-primary to-primary rounded-xl p-6 text-white shadow-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium opacity-90">Total Responses</h4>
                                        <Users className="opacity-80" size={24} />
                                    </div>
                                    <p className="text-3xl font-bold">{analyticsData.totalResponses || 0}</p>
                                </div>
                                <div className="bg-gradient-to-br from-success to-success rounded-xl p-6 text-white shadow-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium opacity-90">Unique Students</h4>
                                        <Users className="opacity-80" size={24} />
                                    </div>
                                    <p className="text-3xl font-bold">{analyticsData.uniqueStudents || 0}</p>
                                </div>
                                <div className="bg-gradient-to-br from-secondary to-secondary rounded-xl p-6 text-white shadow-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium opacity-90">Subjects</h4>
                                        <MessageSquare className="opacity-80" size={24} />
                                    </div>
                                    <p className="text-3xl font-bold">{analyticsData.subjectsCount || 0}</p>
                                </div>
                                <div className="bg-gradient-to-br from-warning to-warning rounded-xl p-6 text-white shadow-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium opacity-90">Courses</h4>
                                        <TrendingUp className="opacity-80" size={24} />
                                    </div>
                                    <p className="text-3xl font-bold">{analyticsData.coursesCount || 0}</p>
                                </div>
                            </div>

                            {/* Subject-wise Breakdown Table */}
                            <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
                                <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white">
                                    <h3 className="text-xl font-bold">{filters.formId ? forms.find(f => f.form_id === filters.formId)?.form_name : 'Feedback Form'}</h3>
                                    <p className="text-sm opacity-90 mt-1">Subject-wise feedback analysis</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-primary text-white">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-sm font-semibold">SUBJECT</th>
                                                <th className="px-6 py-3 text-left text-sm font-semibold">STAFF</th>
                                                <th className="px-6 py-3 text-center text-sm font-semibold">COUNT</th>
                                                <th className="px-6 py-3 text-center text-sm font-semibold">AVG RATING</th>
                                                <th className="px-6 py-3 text-center text-sm font-semibold">REMARKS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {analyticsData.subjectBreakdown?.length > 0 ? (
                                                analyticsData.subjectBreakdown.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-background">
                                                        <td className="px-6 py-4 text-sm font-medium text-main">{item.subjectName}</td>
                                                        <td className="px-6 py-4 text-sm text-sub">{item.facultyName}</td>
                                                        <td className="px-6 py-4 text-sm text-center font-semibold text-primary">{item.responseCount}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${item.averageRating >= 4 ? 'bg-[var(--success-light)] text-success' :
                                                                    item.averageRating >= 3 ? 'bg-[var(--warning-light)] text-warning' :
                                                                        'bg-[var(--danger-light)] text-danger'
                                                                }`}>
                                                                {item.averageRating ? item.averageRating.toFixed(2) : 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-center text-sub">{item.remarks || '-'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-12 text-center text-muted-text">
                                                        No responses found for the selected filters
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
                            <BarChart3 className="mx-auto text-muted-text mb-4" size={48} />
                            <h3 className="text-lg font-semibold text-main mb-2">No Analytics Available</h3>
                            <p className="text-sub">Select a feedback form to view analytics</p>
                        </div>
                    )}
                </div>
            )}

            {/* QR Modal */}
            {showQRModal && selectedForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-main mb-4">{selectedForm.form_name}</h3>
                        <div className="bg-surface p-6 rounded-lg border-2 border-border mb-4 flex items-center justify-center">
                            <QRCodeComponent
                                id="qr-code-svg"
                                value={`${getFrontendUrl()}/form/${selectedForm.form_id}`}
                                size={256}
                            />
                        </div>
                        <p className="text-sm text-sub mb-4 text-center">
                            Scan this QR code to access the feedback form
                        </p>
                        <div className="text-xs text-sub text-center bg-background rounded-lg p-2 mb-4 font-mono break-all">
                            {getFrontendUrl()}/form/{selectedForm.form_id}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={downloadQRCode} className="flex-1 flex items-center justify-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors">
                                <Download size={18} />
                                Download
                            </button>
                            <button onClick={() => setShowQRModal(false)} className="flex-1 bg-background text-sub px-4 py-2 rounded-lg hover:bg-background transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeedbackForms;
