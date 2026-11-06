import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
    Eye,
    EyeOff,
    Edit3,
    Lock,
    Save,
    X,
    Check,
    ChevronLeft,
    User,
    Mail,
    Phone,
    MapPin,
    GraduationCap,
    FileText,
    Calendar,
    Shield,
    AlertCircle,
    CheckCircle2,
    BookOpen,
    Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';

// Icon mapping for dynamic field categories
const ICON_MAP = {
    User,
    Phone,
    GraduationCap,
    Users,
    FileText,
    BookOpen,
    Shield
};

// Student data field groups with all possible fields
const STUDENT_FIELD_GROUPS = [
    {
        id: 'basic',
        label: 'Basic Information',
        icon: User,
        color: 'blue',
        fields: [
            { key: 'name', label: 'Student Name', type: 'text' },
            { key: 'email', label: 'Email Address', type: 'email' },
            { key: 'phone', label: 'Phone Number', type: 'tel' },
            { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
            { key: 'gender', label: 'Gender', type: 'select' },
            { key: 'blood_group', label: 'Blood Group', type: 'select' },
            { key: 'aadhar_number', label: 'Aadhar Number', type: 'text' },
        ]
    },
    {
        id: 'contact',
        label: 'Contact Details',
        icon: Phone,
        color: 'green',
        fields: [
            { key: 'address', label: 'Address', type: 'textarea' },
            { key: 'city', label: 'City/Village', type: 'text' },
            { key: 'mandal', label: 'Mandal', type: 'text' },
            { key: 'district', label: 'District', type: 'text' },
            { key: 'state', label: 'State', type: 'text' },
            { key: 'pincode', label: 'PIN Code', type: 'text' },
            { key: 'emergency_contact', label: 'Emergency Contact', type: 'tel' },
        ]
    },
    {
        id: 'academic',
        label: 'Academic Information',
        icon: GraduationCap,
        color: 'purple',
        fields: [
            { key: 'admission_number', label: 'Admission Number', type: 'text' },
            { key: 'pin_number', label: 'PIN Number', type: 'text' },
            { key: 'college_name', label: 'College', type: 'select' },
            { key: 'course_name', label: 'Program', type: 'select' },
            { key: 'branch_name', label: 'Branch', type: 'select' },
            { key: 'year', label: 'Year', type: 'select' },
            { key: 'semester', label: 'Semester', type: 'select' },
            { key: 'section', label: 'Section', type: 'text' },
            { key: 'admission_date', label: 'Admission Date', type: 'date' },
            { key: 'roll_number', label: 'Roll Number', type: 'text' },
        ]
    },
    {
        id: 'parent',
        label: 'Parent Information',
        icon: User,
        color: 'amber',
        fields: [
            { key: 'father_name', label: 'Father Name', type: 'text' },
            { key: 'father_phone', label: 'Father Phone', type: 'tel' },
            { key: 'father_occupation', label: 'Father Occupation', type: 'text' },
            { key: 'mother_name', label: 'Mother Name', type: 'text' },
            { key: 'mother_phone', label: 'Mother Phone', type: 'tel' },
            { key: 'mother_occupation', label: 'Mother Occupation', type: 'text' },
            { key: 'parent_email', label: 'Parent Email', type: 'email' },
        ]
    },
    {
        id: 'documents',
        label: 'Documents & Certificates',
        icon: FileText,
        color: 'rose',
        fields: [
            { key: 'tc_status', label: 'TC Status', type: 'select' },
            { key: 'certificates_status', label: 'Certificates Status', type: 'select' },
            { key: 'student_photo', label: 'Student Photo', type: 'file' },
            { key: 'documents', label: 'Other Documents', type: 'file' },
        ]
    },
    {
        id: 'previous_education',
        label: 'Previous Education',
        icon: GraduationCap,
        color: 'indigo',
        fields: [
            { key: 'ssc_school', label: 'SSC School Name', type: 'text' },
            { key: 'ssc_board', label: 'SSC Board', type: 'text' },
            { key: 'ssc_percentage', label: 'SSC Percentage', type: 'number' },
            { key: 'ssc_year', label: 'SSC Year of Passing', type: 'text' },
            { key: 'inter_college', label: 'Inter/Diploma College', type: 'text' },
            { key: 'inter_board', label: 'Inter/Diploma Board', type: 'text' },
            { key: 'inter_percentage', label: 'Inter/Diploma Percentage', type: 'number' },
            { key: 'inter_year', label: 'Inter/Diploma Year', type: 'text' },
        ]
    },
    {
        id: 'status',
        label: 'Status & Administrative',
        icon: Shield,
        color: 'slate',
        fields: [
            { key: 'student_status', label: 'Student Status', type: 'select' },
            { key: 'registration_status', label: 'Registration Status', type: 'select' },
            { key: 'hostel_required', label: 'Hostel Required', type: 'checkbox' },
            { key: 'transport_required', label: 'Transport Required', type: 'checkbox' },
            { key: 'scholarship_applied', label: 'Scholarship Applied', type: 'checkbox' },
            { key: 'remarks', label: 'Remarks/Notes', type: 'textarea' },
        ]
    }
];

const StudentFieldPermissions = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { userId: urlUserId } = useParams();

    // Get user data from location state or use URL param as fallback
    const { user: userData, userId: stateUserId } = location.state || {};
    const userId = stateUserId || urlUserId;

    const [userInfo, setUserInfo] = useState(userData);
    const [fieldCategories, setFieldCategories] = useState(STUDENT_FIELD_GROUPS); // Start with default, will be replaced by API data
    const [fieldPermissions, setFieldPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingFields, setLoadingFields] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeGroup, setActiveGroup] = useState('basic');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!userId) {
            toast.error('User ID not provided');
            navigate('/users');
            return;
        }
        loadStudentFields();
        loadFieldPermissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const loadStudentFields = async () => {
        try {
            setLoadingFields(true);
            const response = await api.get('/rbac/users/student-fields');

            if (response.data?.success) {
                const categories = response.data.data.categories || [];

                // Map icon strings to actual icon components
                const categoriesWithIcons = categories.map(cat => ({
                    ...cat,
                    icon: ICON_MAP[cat.icon] || Shield // Fallback to Shield if icon not found
                }));

                setFieldCategories(categoriesWithIcons);

                // Set first category as active by default if not set
                if (categoriesWithIcons.length > 0 && activeGroup === 'basic') {
                    setActiveGroup(categoriesWithIcons[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading student fields:', error);
            toast.error('Failed to load student fields. Using default fields.');
            // Keep using STUDENT_FIELD_GROUPS as fallback
        } finally {
            setLoadingFields(false);
        }
    };

    const loadFieldPermissions = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/rbac/users/${userId}`);

            if (response.data?.success) {
                const user = response.data.data;

                // Set user info if not already set from state
                if (!userInfo) {
                    setUserInfo(user);
                }

                const permissions = user.permissions || {};
                const studentMgmt = permissions.student_management || {};

                // Extract field-level permissions from the student_management object
                const fieldPerms = studentMgmt.field_permissions || {};
                setFieldPermissions(fieldPerms);
            }
        } catch (error) {
            console.error('Error loading field permissions:', error);
            toast.error('Failed to load field permissions');
        } finally {
            setLoading(false);
        }
    };

    const toggleFieldPermission = (fieldKey, permissionType) => {
        setFieldPermissions(prev => {
            const current = prev[fieldKey] || { view: false, edit: false };
            const updated = {
                ...current,
                [permissionType]: !current[permissionType]
            };

            // If edit is enabled, automatically enable view
            if (permissionType === 'edit' && updated.edit) {
                updated.view = true;
            }

            // If view is disabled, automatically disable edit
            if (permissionType === 'view' && !updated.view) {
                updated.edit = false;
            }

            return {
                ...prev,
                [fieldKey]: updated
            };
        });
    };

    const setGroupPermissions = (groupId, permissionType, value) => {
        const group = fieldCategories.find(g => g.id === groupId);
        if (!group) return;

        setFieldPermissions(prev => {
            const updated = { ...prev };
            group.fields.forEach(field => {
                const current = updated[field.key] || { view: false, edit: false };
                updated[field.key] = {
                    ...current,
                    [permissionType]: value
                };

                // Apply same logic as individual toggle
                if (permissionType === 'edit' && value) {
                    updated[field.key].view = true;
                }
                if (permissionType === 'view' && !value) {
                    updated[field.key].edit = false;
                }
            });
            return updated;
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Get current user permissions
            const currentUser = await api.get(`/rbac/users/${userId}`);
            const currentPermissions = currentUser.data?.data?.permissions || {};

            // Update student_management permissions with field-level permissions
            const updatedPermissions = {
                ...currentPermissions,
                student_management: {
                    ...(currentPermissions.student_management || {}),
                    field_permissions: fieldPermissions
                }
            };

            const response = await api.put(`/rbac/users/${userId}`, {
                permissions: updatedPermissions
            });

            if (response.data?.success) {
                toast.success('Field permissions saved successfully!');
            }
        } catch (error) {
            console.error('Error saving field permissions:', error);
            toast.error(error.response?.data?.message || 'Failed to save field permissions');
        } finally {
            setSaving(false);
        }
    };

    const getGroupStats = (groupId) => {
        const group = fieldCategories.find(g => g.id === groupId);
        if (!group) return { viewCount: 0, editCount: 0, total: 0 };

        let viewCount = 0;
        let editCount = 0;

        group.fields.forEach(field => {
            const perms = fieldPermissions[field.key] || { view: false, edit: false };
            if (perms.view) viewCount++;
            if (perms.edit) editCount++;
        });

        return { viewCount, editCount, total: group.fields.length };
    };

    const filteredGroups = fieldCategories.map(group => ({
        ...group,
        fields: group.fields.filter(field =>
            field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.key.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(group => group.fields.length > 0 || searchTerm === '');

    const activeGroupData = fieldCategories.find(g => g.id === activeGroup);
    const colorClasses = {
        blue: { bg: 'bg-[var(--primary-light)]', text: 'text-primary', border: 'border-[var(--primary-light)]', icon: 'text-primary' },
        green: { bg: 'bg-[var(--success-light)]', text: 'text-success', border: 'border-[var(--success-light)]', icon: 'text-success' },
        purple: { bg: 'bg-[var(--primary-light)]', text: 'text-secondary', border: 'border-[var(--primary-light)]', icon: 'text-secondary' },
        amber: { bg: 'bg-[var(--warning-light)]', text: 'text-warning', border: 'border-[var(--warning-light)]', icon: 'text-warning' },
        rose: { bg: 'bg-[var(--danger-light)]', text: 'text-danger', border: 'border-[var(--danger-light)]', icon: 'text-danger' },
        indigo: { bg: 'bg-[var(--primary-light)]', text: 'text-primary', border: 'border-[var(--primary-light)]', icon: 'text-primary' },
        slate: { bg: 'bg-background', text: 'text-sub', border: 'border-border', icon: 'text-sub' },
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sub">Loading field permissions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-surface border-b border-border sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/users')}
                                className="p-2 hover:bg-background rounded-lg transition-colors"
                            >
                                <ChevronLeft size={20} className="text-sub" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-main flex items-center gap-2">
                                    <Shield className="text-primary" size={24} />
                                    Student Field Permissions
                                </h1>
                                <p className="text-sm text-muted-text">
                                    Configure field-level access for <span className="font-semibold">{userInfo?.name || 'Loading...'}</span> ({userInfo?.email || ''})
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/users')}
                                className="px-4 py-2 text-sm font-semibold text-sub bg-surface border border-border rounded-lg hover:bg-background transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-primary flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-primary mb-1">Field-Level Access Control</h3>
                            <p className="text-xs text-primary mb-3">
                                Configure which specific student data fields this user can view and edit.
                                Enable <strong>View</strong> to allow viewing the field, and <strong>Edit</strong> to allow modifications.
                                Edit permission automatically grants view access.
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={() => {
                                        // Grant view to all fields in all categories
                                        const allPerms = {};
                                        fieldCategories.forEach(category => {
                                            category.fields.forEach(field => {
                                                allPerms[field.key] = { view: true, edit: false };
                                            });
                                        });
                                        setFieldPermissions(allPerms);
                                        toast.success('View permission granted to all fields!');
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold bg-success text-white rounded-lg hover:bg-success transition-colors flex items-center gap-1.5"
                                >
                                    <Eye size={14} />
                                    Grant All View
                                </button>
                                <button
                                    onClick={() => {
                                        setFieldPermissions({});
                                        toast.success('All permissions revoked!');
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold bg-background text-white rounded-lg hover:bg-background transition-colors flex items-center gap-1.5"
                                >
                                    <X size={14} />
                                    Revoke All
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Sidebar - Field Groups */}
                    <div className="lg:col-span-1">
                        <div className="bg-surface rounded-lg border border-border overflow-hidden sticky top-24">
                            <div className="p-4 border-b border-border">
                                <h3 className="text-sm font-semibold text-sub">Field Categories</h3>
                            </div>
                            <div className="p-2 space-y-1 max-h-[calc(100vh-16rem)] overflow-y-auto">
                                {fieldCategories.map(group => {
                                    const stats = getGroupStats(group.id);
                                    const Icon = group.icon;
                                    const isActive = activeGroup === group.id;
                                    const colors = colorClasses[group.color];

                                    return (
                                        <button
                                            key={group.id}
                                            onClick={() => setActiveGroup(group.id)}
                                            className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg text-left transition-all ${isActive
                                                ? `${colors.bg} ${colors.text} border ${colors.border} shadow-sm`
                                                : 'bg-surface text-sub hover:bg-background'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <Icon size={18} className={isActive ? colors.icon : 'text-muted-text'} />
                                                <span className="text-sm font-medium truncate">{group.label}</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="text-[10px] text-muted-text">
                                                    {stats.viewCount}/{stats.total} view
                                                </span>
                                                <span className="text-[10px] text-muted-text">
                                                    {stats.editCount}/{stats.total} edit
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Content - Field Permissions */}
                    <div className="lg:col-span-3">
                        <div className="bg-surface rounded-lg border border-border overflow-hidden">
                            {/* Group Header */}
                            {activeGroupData && (
                                <div className={`${colorClasses[activeGroupData.color].bg} border-b ${colorClasses[activeGroupData.color].border} p-4`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 ${colorClasses[activeGroupData.color].bg} rounded-lg flex items-center justify-center border ${colorClasses[activeGroupData.color].border}`}>
                                                <activeGroupData.icon className={colorClasses[activeGroupData.color].icon} size={20} />
                                            </div>
                                            <div>
                                                <h2 className={`text-lg font-bold ${colorClasses[activeGroupData.color].text}`}>
                                                    {activeGroupData.label}
                                                </h2>
                                                <p className="text-xs text-sub">
                                                    {activeGroupData.fields.length} fields available
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setGroupPermissions(activeGroup, 'view', true)}
                                                className="px-3 py-1.5 text-xs font-semibold bg-[var(--success-light)] text-success rounded-lg hover:bg-[var(--success-light)] border border-[var(--success-light)] transition-colors"
                                            >
                                                Grant All View
                                            </button>
                                            <button
                                                onClick={() => setGroupPermissions(activeGroup, 'edit', true)}
                                                className="px-3 py-1.5 text-xs font-semibold bg-[var(--primary-light)] text-primary rounded-lg hover:bg-[var(--primary-light)] border border-[var(--primary-light)] transition-colors"
                                            >
                                                Grant All Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setGroupPermissions(activeGroup, 'view', false);
                                                    setGroupPermissions(activeGroup, 'edit', false);
                                                }}
                                                className="px-3 py-1.5 text-xs font-semibold bg-background text-sub rounded-lg hover:bg-background border border-border transition-colors"
                                            >
                                                Revoke All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Fields List */}
                            <div className="p-4">
                                <div className="space-y-2">
                                    {activeGroupData?.fields.map(field => {
                                        const perms = fieldPermissions[field.key] || { view: false, edit: false };

                                        return (
                                            <div
                                                key={field.key}
                                                className="flex items-center justify-between gap-4 p-3 border border-border rounded-lg hover:border-border-strong transition-colors"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-medium text-main truncate">
                                                        {field.label}
                                                    </h4>
                                                    <p className="text-xs text-muted-text">
                                                        Field: <code className="text-xs bg-background px-1.5 py-0.5 rounded">{field.key}</code>
                                                        {' • '}
                                                        Type: {field.type}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* View Permission */}
                                                    <button
                                                        onClick={() => toggleFieldPermission(field.key, 'view')}
                                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${perms.view
                                                            ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
                                                            : 'bg-background text-sub border border-border hover:bg-background'
                                                            }`}
                                                    >
                                                        {perms.view ? <Eye size={14} /> : <EyeOff size={14} />}
                                                        View
                                                    </button>

                                                    {/* Edit Permission */}
                                                    <button
                                                        onClick={() => toggleFieldPermission(field.key, 'edit')}
                                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${perms.edit
                                                            ? 'bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]'
                                                            : 'bg-background text-sub border border-border hover:bg-background'
                                                            }`}
                                                        disabled={!perms.view}
                                                    >
                                                        {perms.edit ? <Edit3 size={14} /> : <Lock size={14} />}
                                                        Edit
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentFieldPermissions;
