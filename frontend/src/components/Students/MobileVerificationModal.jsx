import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, Shield, AlertCircle, Send, KeyRound, Smartphone } from 'lucide-react';
import api from '../../config/api';
import { toast } from 'react-hot-toast';
import {
  isStudentMobileVerifiedForCycle,
  isParentMobileVerifiedForCycle
} from '../../config/registrationCycle';

const parseStudentData = (student) => {
  const raw = student?.student_data;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
};

const MobileVerificationModal = ({ isOpen, onClose, student, onVerificationComplete }) => {
    const [loading, setLoading] = useState(false);
    const [selectedType, setSelectedType] = useState('student'); // 'student' or 'parent'
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [timer, setTimer] = useState(0);
    const [profileUpdateConfig, setProfileUpdateConfig] = useState({ enabledFields: [] });
    const [availableFields, setAvailableFields] = useState([]);
    const [fieldValues, setFieldValues] = useState({});
    const [configLoading, setConfigLoading] = useState(false);


    // Reset state when type changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setOtpSent(false);
            setOtp('');
            setTimer(0);
            fetchConfigAndFields();
        }
    }, [isOpen, selectedType]);

    const fetchConfigAndFields = async () => {
        setConfigLoading(true);
        const studentData = parseStudentData(student);
        try {
            // Fetch enabled fields config
            const configRes = await api.get('/settings/profile-update-fields');
            const enabledFields = configRes.data?.data?.enabledFields || [];
            setProfileUpdateConfig({ enabledFields });

            if (enabledFields.length > 0) {
                // Fetch field definitions to get labels/types
                const fieldsRes = await api.get('/rbac/users/student-fields');

                const categories = fieldsRes.data?.data?.categories || [];
                const allFields = categories.flatMap(cat => cat.fields);
                setAvailableFields(allFields);

                // Initialize field values from student data
                const initialValues = {};
                enabledFields.forEach(fieldKey => {
                    initialValues[fieldKey] = student[fieldKey] || studentData[fieldKey] || '';
                });
                setFieldValues(initialValues);
            }
        } catch (error) {
            console.error('Failed to fetch profile update config:', error);
        } finally {
            setConfigLoading(false);
        }
    };


    // Timer countdown
    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    if (!isOpen || !student) return null;

    const studentData = parseStudentData(student);
    const currentYear = student.current_year || studentData.current_year;
    const currentSem = student.current_semester || studentData.current_semester;

    const studentMobile = student.student_mobile || studentData.student_mobile;
    const parentMobile = student.parent_mobile1 || studentData.parent_mobile1;

    const isStudentVerified = isStudentMobileVerifiedForCycle(studentData, currentYear, currentSem);
    const isParentVerified = isParentMobileVerifiedForCycle(studentData, currentYear, currentSem);

    const getCurrentMobile = () => {
        return selectedType === 'student' ? studentMobile : parentMobile;
    };

    const isCurrentVerified = () => {
        return selectedType === 'student' ? isStudentVerified : isParentVerified;
    };

    const handleSendOtp = async () => {
        const mobile = getCurrentMobile();
        if (!mobile) {
            toast.error('No mobile number available');
            return;
        }

        try {
            setLoading(true);

            // Check if any profile fields were modified and submit request if needed
            const modifiedFields = {};
            let hasChanges = false;
            profileUpdateConfig.enabledFields.forEach(fieldKey => {
                const originalValue = student[fieldKey] || studentData[fieldKey] || '';
                if (String(fieldValues[fieldKey] || '').trim() !== String(originalValue || '').trim()) {
                    modifiedFields[fieldKey] = fieldValues[fieldKey];
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                try {
                    await api.post('/profile-changes/submit', {
                        admission_number: student.admission_number,
                        requested_changes: modifiedFields
                    });
                    toast.success('Profile update request submitted');
                } catch (err) {
                    // If it's a "already pending" error, we can still proceed with OTP
                    if (err.response?.data?.message?.includes('already have a pending')) {
                        console.warn('Pending request already exists');
                    } else {
                        throw err; // Re-throw other errors
                    }
                }
            }

            const response = await api.post('/students/otp/send', {
                admissionNumber: student.admission_number,
                mobileNumber: mobile,
                type: selectedType,
                year: student.current_year || '1',
                semester: student.current_semester || '1'
            });

            if (response.data.success) {
                toast.success('OTP sent successfully');
                setOtpSent(true);
                setTimer(60);
            } else {
                toast.error(response.data.message || 'Failed to send OTP');
            }
        } catch (error) {
            console.error('Send OTP error:', error);
            toast.error(error.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };


    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 6) {
            toast.error('Please enter a valid 6-digit OTP');
            return;
        }

        const mobile = getCurrentMobile();

        try {
            setLoading(true);
            const response = await api.post('/students/otp/verify', {
                admissionNumber: student.admission_number,
                mobileNumber: mobile,
                otp: otp,
                type: selectedType
            });

            if (response.data.success) {
                toast.success('Mobile verified successfully');
                await onVerificationComplete?.();

                setOtpSent(false);
                setOtp('');
            } else {
                toast.error(response.data.message || 'Invalid OTP');
            }
        } catch (error) {
            console.error('Verify OTP error:', error);
            toast.error(error.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const maskMobile = (number) => {
        if (!number) return 'No Number';
        if (number.length < 4) return number;
        return number.slice(0, 2) + '******' + number.slice(-2);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-[var(--sidebar)]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-[var(--background)]/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[var(--primary-light)] text-primary rounded-lg">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-main">Mobile Verification</h3>
                            <p className="text-xs text-muted-text">OTP-based verification</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-muted-text hover:text-sub transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    <div className="space-y-4">
                        {/* Type Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setSelectedType('student'); setOtpSent(false); }}
                                className={`relative p-3 rounded-lg border-2 text-left transition-all ${selectedType === 'student'
                                    ? 'border-primary bg-[var(--primary-light)] ring-1 ring-[var(--primary-light)]'
                                    : 'border-border hover:border-border-strong hover:bg-background'
                                    }`}
                            >
                                {isStudentVerified && (
                                    <div className="absolute top-2 right-2 text-success bg-surface rounded-full">
                                        <CheckCircle size={16} fill="currentColor" className="text-white" />
                                        <CheckCircle size={16} className="absolute inset-0 text-success" />
                                    </div>
                                )}
                                <span className="block text-xs font-semibold text-muted-text uppercase tracking-wide">Student</span>
                                <span className="block font-medium text-main mt-0.5 truncate">
                                    {studentMobile || 'No Number'}
                                </span>
                                <span className={`text-xs mt-2 inline-block px-1.5 py-0.5 rounded ${isStudentVerified ? 'bg-[var(--success-light)] text-success' : 'bg-background text-sub'}`}>
                                    {isStudentVerified ? 'Verified' : 'Pending'}
                                </span>
                            </button>

                            <button
                                onClick={() => { setSelectedType('parent'); setOtpSent(false); }}
                                className={`relative p-3 rounded-lg border-2 text-left transition-all ${selectedType === 'parent'
                                    ? 'border-primary bg-[var(--primary-light)] ring-1 ring-[var(--primary-light)]'
                                    : 'border-border hover:border-border-strong hover:bg-background'
                                    }`}
                            >
                                {isParentVerified && (
                                    <div className="absolute top-2 right-2 text-success bg-surface rounded-full">
                                        <CheckCircle size={16} fill="currentColor" className="text-white" />
                                        <CheckCircle size={16} className="absolute inset-0 text-success" />
                                    </div>
                                )}
                                <span className="block text-xs font-semibold text-muted-text uppercase tracking-wide">Parent</span>
                                <span className="block font-medium text-main mt-0.5 truncate">
                                    {parentMobile || 'No Number'}
                                </span>
                                <span className={`text-xs mt-2 inline-block px-1.5 py-0.5 rounded ${isParentVerified ? 'bg-[var(--success-light)] text-success' : 'bg-background text-sub'}`}>
                                    {isParentVerified ? 'Verified' : 'Pending'}
                                </span>
                            </button>
                        </div>

                        {/* Action Area */}
                        <div className="pt-2">
                            {isCurrentVerified() ? (
                                <div className="bg-[var(--success-light)] border border-[var(--success-light)] rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 bg-[var(--success-light)] rounded-full flex items-center justify-center mb-2">
                                        <CheckCircle size={24} className="text-success" />
                                    </div>
                                    <h4 className="font-semibold text-success">Verified Successfully</h4>
                                    <p className="text-sm text-success mt-1">
                                        The {selectedType} mobile number is verified.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {!otpSent ? (
                                        <div className="bg-background border border-border rounded-lg p-4 space-y-4">
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-[var(--primary-light)] rounded-full flex items-center justify-center mx-auto mb-2">
                                                    <Smartphone size={24} className="text-primary" />
                                                </div>
                                                <p className="text-sm text-sub mb-1">Verify your details & send OTP</p>
                                                <p className="font-semibold text-main text-lg tracking-wider">
                                                    {maskMobile(getCurrentMobile())}
                                                </p>
                                            </div>

                                            {/* Dynamic Profile Fields */}
                                            {profileUpdateConfig.enabledFields.length > 0 && (
                                                <div className="space-y-3 pt-2 border-t border-border">
                                                    <p className="text-[10px] font-bold text-muted-text uppercase tracking-widest text-center">Verify / Update Information</p>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {profileUpdateConfig.enabledFields.map(fieldKey => {
                                                            const fieldDef = availableFields.find(f => f.key === fieldKey);
                                                            if (!fieldDef) return null;

                                                            return (
                                                                <div key={fieldKey} className="flex flex-col gap-1">
                                                                    <label className="text-[10px] font-bold text-muted-text uppercase ml-1">
                                                                        {fieldDef.label}
                                                                    </label>
                                                                    <input
                                                                        type={fieldDef.type === 'number' ? 'number' : 'text'}
                                                                        value={fieldValues[fieldKey] || ''}
                                                                        onChange={(e) => setFieldValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                        className="w-full px-3 py-2 bg-surface border border-border-strong rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none shadow-sm"
                                                                        placeholder={`Enter ${fieldDef.label}`}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                onClick={handleSendOtp}
                                                disabled={loading || !getCurrentMobile()}
                                                className="w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                                            >
                                                {loading ? (
                                                    <span className="w-5 h-5 border-2 border-surface border-t-surface rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <Send size={16} /> Send OTP
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-surface border border-border rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-[var(--primary-light)] rounded-full flex items-center justify-center mx-auto mb-2">
                                                    <KeyRound size={24} className="text-secondary" />
                                                </div>
                                                <h4 className="font-medium text-main">Enter OTP</h4>
                                                <p className="text-xs text-muted-text mt-1">
                                                    Sent to {maskMobile(getCurrentMobile())}
                                                </p>
                                            </div>

                                            <input
                                                type="text"
                                                value={otp}
                                                onChange={(e) => {
                                                    // Only allow numbers and max 6 digits
                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                    setOtp(val);
                                                }}
                                                placeholder="- - - - - -"
                                                className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 border border-border-strong rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all"
                                                maxLength={6}
                                                disabled={loading}
                                                autoFocus
                                            />

                                            <button
                                                onClick={handleVerifyOtp}
                                                disabled={loading || otp.length < 6}
                                                className="w-full py-2.5 bg-secondary text-white rounded-lg hover:bg-secondary font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                                            >
                                                {loading ? (
                                                    <span className="w-5 h-5 border-2 border-surface border-t-surface rounded-full animate-spin" />
                                                ) : (
                                                    'Verify OTP'
                                                )}
                                            </button>

                                            <div className="text-center">
                                                {timer > 0 ? (
                                                    <p className="text-xs text-muted-text">
                                                        Resend in {timer}s
                                                    </p>
                                                ) : (
                                                    <button
                                                        onClick={handleSendOtp}
                                                        disabled={loading}
                                                        className="text-xs text-primary hover:text-primary hover:underline font-medium"
                                                    >
                                                        Resend OTP
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setOtpSent(false)}
                                                    className="block w-full mt-2 text-xs text-muted-text hover:text-sub"
                                                >
                                                    Change Number
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>,
        document.body
    );
};

export default MobileVerificationModal;
