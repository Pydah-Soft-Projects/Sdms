import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Phone,
    ShieldCheck,
    ArrowRight,
    CheckCircle,
    Loader2,
    Smartphone,
    BookOpen,
    RefreshCw,
    FileText,
    Zap,
    AlertCircle,
    X,
    Award,
    History,
    ChevronDown
} from 'lucide-react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import api from '../../config/api';
import {
  isStudentMobileVerifiedForCycle,
  isParentMobileVerifiedForCycle,
  isCertificatesStatusComplete
} from '../../config/registrationCycle';
import {
  getCourseType,
  getCertificatesForCourse,
  normalizeCertificateValue
} from '../../config/certificateConfig';
import {
  computeRegistrationStageDisplays,
  RegistrationStageBadge,
  isRegistrationPortalUnlocked
} from '../../config/registrationStages.jsx';
import { resolveRegistrationBranchYear } from '../../config/registrationBranchYear';
import { usesSemesterWiseScholarshipStatus } from '../../config/scholarshipConfig';

const SemesterRegistration = () => {
    const { user, updateUser } = useAuthStore();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false); // Action loading
    const [initialLoading, setInitialLoading] = useState(true);
    const [studentData, setStudentData] = useState(null);
    const [scholarshipData, setScholarshipData] = useState(null);
    const [optionalStages, setOptionalStages] = useState([]);
    const [registrationStageConfig, setRegistrationStageConfig] = useState({});
    const [activeStepId, setActiveStepId] = useState(null); // For Modal
    const [showPreviousRegistration, setShowPreviousRegistration] = useState(false);

    // Step 1 State: Verification
    const [verificationState, setVerificationState] = useState({
        studentMobile: '',
        parentMobile: '',
        studentOtpSent: false,
        parentOtpSent: false,
        studentOtp: '',
        parentOtp: '',
        studentVerified: false,
        parentVerified: false
    });

    // Fetch student details
    const fetchStudentDetails = async () => {
        try {
            if (!user?.admission_number) return;
            // setInitialLoading(true); // Don't full reload UI on refresh
            const response = await api.get(`/students/${user.admission_number}`);
            const scholarshipResponse = await api.get(`/student-scholarship/${encodeURIComponent(user.admission_number)}`);

            if (response.data.success) {
                const student = response.data.data;
                const sData = student.student_data || {};
                const parsedData = typeof sData === 'string'
                  ? (() => { try { return JSON.parse(sData || '{}'); } catch { return {}; } })()
                  : sData;
                const studentVerified = isStudentMobileVerifiedForCycle(
                  parsedData,
                  student.current_year,
                  student.current_semester
                );
                const parentVerified = isParentMobileVerifiedForCycle(
                  parsedData,
                  student.current_year,
                  student.current_semester
                );

                setStudentData(student);
                setVerificationState(prev => ({
                    ...prev,
                    studentMobile: student.student_mobile || '',
                    parentMobile: student.parent_mobile1 || student.parent_mobile2 || '',
                    studentVerified,
                    parentVerified
                }));

                // Fetch optional stages for this branch+year using student's current_year
                try {
                    const branchCode = student.branch;
                    const currentYear = student.current_year;
                    if (branchCode && currentYear != null) {
                        const cfgRes = await api.get(
                            `/settings/registration-stage-config/branch/${encodeURIComponent(branchCode)}`
                        );
                        if (cfgRes.data?.success) {
                            const yearData = cfgRes.data.data || {};
                            const configYear = resolveRegistrationBranchYear(branchCode, currentYear);
                            setOptionalStages(yearData[String(configYear)]?.optionalStages || []);
                            setRegistrationStageConfig(
                              Object.fromEntries(
                                Object.entries(yearData).map(([year, config]) => [
                                  `${String(branchCode).trim()}::${year}`,
                                  config
                                ])
                              )
                            );
                        }
                    }
                } catch (e) {
                    // Optional — degrade gracefully
                    setOptionalStages([]);
                    setRegistrationStageConfig({});
                }
            }

            if (scholarshipResponse.data?.success) {
                setScholarshipData(scholarshipResponse.data.data);
            } else {
                setScholarshipData(null);
            }
        } catch (error) {
            console.error('Error fetching student details:', error);
            toast.error('Failed to load student details');
        } finally {
            setInitialLoading(false);
        }
    };

    useEffect(() => {
        fetchStudentDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // ------------ LOGIC HANDLERS ------------

    const handleSendOTP = async (type) => {
        const mobile = type === 'student' ? verificationState.studentMobile : verificationState.parentMobile;
        if (!mobile || mobile.length < 10) {
            toast.error(`Invalid ${type} mobile number`);
            return;
        }
        setLoading(true);
        try {
            const response = await api.post('/students/otp/send', {
                admissionNumber: user.admission_number,
                mobileNumber: mobile,
                year: studentData?.current_year || 'N/A',
                semester: studentData?.current_semester || 'N/A',
                type: type.charAt(0).toUpperCase() + type.slice(1)
            });
            if (response.data.success) {
                setVerificationState(prev => ({
                    ...prev,
                    [type === 'student' ? 'studentOtpSent' : 'parentOtpSent']: true
                }));
                toast.success(`OTP sent to ${mobile.slice(-4).padStart(10, '*')}`);
            } else {
                toast.error(response.data.message || 'Failed to send OTP');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (type) => {
        const otp = type === 'student' ? verificationState.studentOtp : verificationState.parentOtp;
        const mobile = type === 'student' ? verificationState.studentMobile : verificationState.parentMobile;

        if (!otp || otp.length !== 6) {
            toast.error('Enter valid 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/students/otp/verify', {
                admissionNumber: user.admission_number,
                mobileNumber: mobile,
                otp: otp,
                type: type // 'student' or 'parent'
            });
            if (response.data.success) {
                setVerificationState(prev => ({
                    ...prev,
                    [type === 'student' ? 'studentVerified' : 'parentVerified']: true
                }));
                toast.success('Mobile verified successfully!');
                // Automatically refresh data - backend will auto-complete if this was the last step
                fetchStudentDetails();
            } else {
                toast.error(response.data.message || 'Invalid OTP');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    // ------------ STATUS CHECKERS ------------

    const registrationStages = useMemo(
      () => computeRegistrationStageDisplays(
        studentData,
        scholarshipData,
        optionalStages,
        registrationStageConfig
      ),
      [studentData, scholarshipData, optionalStages, registrationStageConfig]
    );

    const getStepStatus = (id) => {
        if (!studentData) return 'pending';

        switch (id) {
            case 1:
                return (registrationStages.verification.completed || registrationStages.verification.optional) ? 'completed' : 'pending';
            case 2:
                return (registrationStages.certificates.completed || registrationStages.certificates.optional) ? 'completed' : 'pending';
            case 3:
                return (registrationStages.fee.completed || registrationStages.fee.optional) ? 'completed' : 'pending';
            case 4:
                return (registrationStages.promotion.completed || registrationStages.promotion.optional) ? 'completed' : 'pending';
            case 5:
                return (registrationStages.scholarship.completed || registrationStages.scholarship.optional) ? 'completed' : 'pending';
            default:
                return 'pending';
        }
    };

    const isStepCompleted = (id) => getStepStatus(id) === 'completed';

    const canFinalize = () => {
        // All 5 stages must be complete (or optional) for registration to finalize.
        // A stage is satisfied if it's actually completed OR if it's in the optionalStages list.
        return isStepCompleted(1) && isStepCompleted(2) && isStepCompleted(3) && isStepCompleted(4) && isStepCompleted(5);
    };

    const autoFinalizedRef = React.useRef(false);

    // Auto-sync when registration reaches Completed or Temporary.
    useEffect(() => {
        if (initialLoading || loading || !studentData) return;
        if (autoFinalizedRef.current) return;

        const overallStatus = registrationStages.overallStatus;
        if (overallStatus !== 'completed' && overallStatus !== 'Temporary') return;

        autoFinalizedRef.current = true;
        const autoFinalize = async () => {
            setLoading(true);
            try {
                const response = await api.get(`/students/${user.admission_number}`);
                if (response.data?.success) {
                    setStudentData(response.data.data);
                    const statusLabel = overallStatus === 'completed' ? 'Completed' : 'Temporary';
                    updateUser({ registration_status: statusLabel });
                    toast.success(
                      overallStatus === 'completed'
                        ? 'Registration finalized automatically!'
                        : 'Registration marked as temporary. Portal access is enabled.'
                    );
                }
            } catch (e) {
                console.error('Auto-finalize sync error:', e);
                autoFinalizedRef.current = false;
            } finally {
                setLoading(false);
            }
        };
        autoFinalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialLoading, scholarshipData, verificationState, registrationStages]);

    // Keep auth store in sync with Completed / Temporary (must run before any early return).
    useEffect(() => {
        if (initialLoading || !studentData) return;
        if (registrationStages.overallStatus === 'completed') {
            const authRegStatus = (user?.registration_status || '').toLowerCase();
            if (authRegStatus !== 'completed') {
                updateUser({ registration_status: 'Completed' });
            }
        } else if (registrationStages.overallStatus === 'Temporary') {
            const authRegStatus = (user?.registration_status || '').toLowerCase();
            if (authRegStatus !== 'temporary') {
                updateUser({ registration_status: 'Temporary' });
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialLoading, registrationStages.overallStatus, studentData]);

    const previousRegistrations = useMemo(() => {
        const sData = studentData?.student_data || {};
        const parsed = typeof sData === 'string'
            ? (() => { try { return JSON.parse(sData || '{}'); } catch { return {}; } })()
            : sData;

        // Check for actual registration history in studentData
        if (Array.isArray(studentData?.previous_registrations) && studentData.previous_registrations.length > 0) {
            return studentData.previous_registrations;
        }
        if (Array.isArray(studentData?.registration_history) && studentData.registration_history.length > 0) {
            return studentData.registration_history;
        }
        if (Array.isArray(parsed?.previous_registrations) && parsed.previous_registrations.length > 0) {
            return parsed.previous_registrations;
        }
        if (Array.isArray(parsed?.registration_history) && parsed.registration_history.length > 0) {
            return parsed.registration_history;
        }

        // Check for nested actual student_data snapshot from previous promotion
        if (parsed?.student_data && typeof parsed.student_data === 'object' && parsed.student_data.current_year) {
            const prev = parsed.student_data;
            return [{
                year: prev.current_year || prev['Current Academic Year'] || '-',
                semester: prev.current_semester || prev['Current Semester'] || '-',
                batch: prev.batch || prev['Batch'] || '-',
                status: prev.registration_status || prev['Registration Status'] || '-',
                verification: prev.is_student_mobile_verified ? 'Verified' : '-',
                certificates: prev.certificates_status || '-',
                fee: prev.fee_status || prev['Fee Status'] || '-',
                promotion: prev.current_year ? `Year ${prev.current_year}` : '-'
            }];
        }

        return [];
    }, [studentData]);

    const courseType = useMemo(() => {
        return getCourseType(studentData?.course || studentData?.program_name || user?.course || 'UG');
    }, [studentData?.course, studentData?.program_name, user?.course]);

    const certificatesList = useMemo(() => {
        const certs = getCertificatesForCourse(courseType);
        const sData = studentData?.student_data || {};
        const parsed = typeof sData === 'string'
            ? (() => { try { return JSON.parse(sData || '{}'); } catch { return {}; } })()
            : sData;

        return certs.map(c => {
            const rawVal = parsed?.[c.key] ?? studentData?.[c.key];
            const norm = normalizeCertificateValue(rawVal);
            const isVerified = norm === 'Original' || norm === 'Yes' || norm === 'Memo' || norm === 'Original Returned' || isCertificatesStatusComplete(studentData?.certificates_status);
            return {
                ...c,
                status: norm && norm !== 'No' ? norm : (isVerified ? 'Verified' : 'Pending'),
                isVerified
            };
        });
    }, [courseType, studentData]);

    // ------------ DATA & CONFIG ------------

    const steps = [
        {
            id: 1,
            title: 'Information Verification',
            description: 'Verify student and parent mobile numbers.',
            icon: ShieldCheck,
            color: 'blue'
        },
        {
            id: 2,
            title: 'Certificates',
            description: 'Check certificate verification status.',
            icon: FileText,
            color: 'purple'
        },
        {
            id: 3,
            title: 'Fee Status',
            description: 'View fee payment status.',
            icon: BookOpen,
            color: 'green'
        },
        {
            id: 4,
            title: 'Promotion',
            description: 'Your current academic year and semester placement.',
            icon: Zap,
            color: 'orange'
        },
        {
            id: 5,
            title: 'Scholarship',
            description: 'Scholarship status must be assigned. For eligible students, fee must also be marked as paid.',
            icon: Award,
            color: 'indigo'
        }
    ];

    if (initialLoading) {
        return (
            <div className="w-full space-y-8 animate-pulse pb-20">
                <div className="space-y-2">
                    <SkeletonBox height="h-8" width="w-64" />
                    <SkeletonBox height="h-4" width="w-96" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-surface rounded-2xl p-6 border-l-4 border-border h-48 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <SkeletonBox height="h-12" width="w-12" className="rounded-xl" />
                                <SkeletonBox height="h-6" width="w-20" className="rounded-full" />
                            </div>
                            <div className="space-y-2">
                                <SkeletonBox height="h-6" width="w-32" />
                                <SkeletonBox height="h-4" width="w-full" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 shadow-lg lg:pl-64">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="space-y-1">
                            <SkeletonBox height="h-4" width="w-32" />
                            <SkeletonBox height="h-3" width="w-48" />
                        </div>
                        <SkeletonBox height="h-12" width="w-48" className="rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    // Overall completion checkers
    const isActuallyComplete = !initialLoading && registrationStages.overallStatus === 'completed';
    const isTemporaryRegistration = !initialLoading && registrationStages.overallStatus === 'Temporary';

    const currentYear = studentData?.current_year ?? '1';
    const currentSemester = studentData?.current_semester ?? '1';

    const stageSummaryItems = [
        { id: 1, title: 'Information Verification', stage: registrationStages.verification },
        { id: 2, title: 'Certificate Status', stage: registrationStages.certificates },
        { id: 3, title: 'Fee Payment', stage: registrationStages.fee },
        { id: 4, title: 'Promotion Status', stage: registrationStages.promotion },
        { id: 5, title: 'Scholarship Status', stage: registrationStages.scholarship }
    ];

    const getStageForStep = (stepId) => {
        const item = stageSummaryItems.find((entry) => entry.id === stepId);
        return item?.stage;
    };

    return (
        <div className="w-full space-y-4 sm:space-y-6 animate-fade-in pb-16 px-3 sm:px-6 pt-3 sm:pt-6">
            {/* ── Cycle Overview Card ── */}
            <div className={`rounded-2xl p-4 sm:p-5 border transition-all shadow-sm ${
                isActuallyComplete
                    ? 'bg-gradient-to-r from-success to-primary text-white border-success'
                    : isTemporaryRegistration
                        ? 'bg-gradient-to-r from-warning to-warning text-white border-warning'
                        : 'bg-surface border-border text-main'
            }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)]/20 text-white">
                                Current Academic Cycle
                            </span>
                            <span className="text-xs font-bold text-white/90">
                                <span className="bg-[var(--surface)]/25 px-2 py-0.5 rounded-md font-black text-white shadow-xs">
                                    Year {currentYear} • Semester {currentSemester}
                                </span>
                                {studentData?.branch ? ` • ${studentData.branch}` : ''}
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                            {isActuallyComplete ? 'Registered' : isTemporaryRegistration ? 'Registration Temporary' : 'Registration In Progress'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 mt-1 sm:mt-0">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs shadow-xs ${
                            isActuallyComplete ? 'bg-surface text-success' : isTemporaryRegistration ? 'bg-surface text-warning' : 'bg-[var(--warning-light)] text-warning'
                        }`}>
                            {isActuallyComplete ? <><CheckCircle size={15} /> Completed</> : isTemporaryRegistration ? <><AlertCircle size={15} /> Temporary</> : 'Pending'}
                        </span>
                        <button
                            onClick={() => navigate('/student/dashboard')}
                            className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--surface)]/20 hover:bg-[var(--surface)]/30 text-white transition-colors"
                        >
                            Dashboard
                        </button>
                    </div>
                </div>
            </div>

            {/* ── 5-Stage Stepper: (Vertical Step-by-Step, One Below One) ── */}
            <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                    <h3 className="text-xs font-black uppercase tracking-wider text-main">Registration Process Steps</h3>
                    <span className="text-[10px] font-bold text-success bg-[var(--success-light)] px-2 py-0.5 rounded-full">
                        {isActuallyComplete ? '5 of 5 Completed' : 'In Progress'}
                    </span>
                </div>
                <div className="space-y-0">
                    {stageSummaryItems.map((item, index) => {
                        const isDone = item.stage.completed || item.stage.optional;
                        const isLast = index === stageSummaryItems.length - 1;

                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (item.id === 5) {
                                        navigate('/student/scholarship');
                                    } else {
                                        setActiveStepId(item.id);
                                    }
                                }}
                                className="flex gap-3 group cursor-pointer active:scale-[0.99] transition-transform"
                            >
                                {/* Left: Step Circle and Vertical Connecting Line */}
                                <div className="flex flex-col items-center">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs transition-all shadow-xs shrink-0 ${
                                        isDone ? 'bg-success text-white ring-4 ring-[var(--success-light)]' : 'bg-sidebar text-white ring-4 ring-border-strong'
                                    }`}>
                                        {isDone ? <CheckCircle size={14} strokeWidth={2.5} /> : <span>{index + 1}</span>}
                                    </div>
                                    {!isLast && (
                                        <div className={`w-0.5 my-1 flex-1 min-h-[24px] rounded-full transition-colors ${
                                            isDone ? 'bg-success' : 'bg-background'
                                        }`} />
                                    )}
                                </div>

                                {/* Right: Step Info (One Below One) */}
                                <div className={`flex-1 flex items-center justify-between pb-3`}>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-text">Stage {index + 1}</span>
                                        </div>
                                        <h4 className="text-xs font-bold text-main group-hover:text-success transition-colors">
                                            {item.title}
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                            isDone ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--warning-light)] text-warning'
                                        }`}>
                                            {isDone ? 'Done' : 'Pending'}
                                        </span>
                                        <ArrowRight size={12} className="text-muted-text group-hover:text-success group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Previous Registration Button & History ── */}
            <div className="space-y-2.5">
                <button
                    type="button"
                    onClick={() => setShowPreviousRegistration(prev => !prev)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-surface rounded-2xl border border-border shadow-xs hover:bg-background active:scale-[0.99] transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-primary flex items-center justify-center font-bold">
                            <History size={16} />
                        </div>
                        <div className="text-left">
                            <span className="text-xs font-black text-main block">Previous Registration</span>
                            <span className="text-[10px] text-muted-text font-medium">View past academic year registrations</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                        <span>{showPreviousRegistration ? 'Hide' : 'View'}</span>
                        <ChevronDown size={16} className={`transition-transform duration-200 ${showPreviousRegistration ? 'rotate-180' : ''}`} />
                    </div>
                </button>

                {showPreviousRegistration && (
                    <div className="space-y-2.5 pt-0.5 animate-fade-in">
                        {previousRegistrations.length > 0 ? (
                            previousRegistrations.map((prev, idx) => (
                                <div
                                    key={idx}
                                    className="bg-surface rounded-2xl border border-border p-3.5 shadow-xs"
                                >
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-[var(--primary-light)] text-primary flex items-center justify-center font-bold text-xs">
                                                <History size={14} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-main">
                                                    {prev.year && prev.year !== '-' ? `Year ${prev.year}` : '-'} {prev.semester && prev.semester !== '-' ? `• Semester ${prev.semester}` : ''}
                                                </h4>
                                                <p className="text-[10px] text-muted-text font-medium">{prev.batch || prev.academic_year || '-'}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                            String(prev.status || '').toLowerCase() === 'completed'
                                                ? 'bg-[var(--success-light)] text-success'
                                                : 'bg-background text-sub'
                                        }`}>
                                            {prev.status || '-'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="bg-[var(--background)]/80 rounded-xl p-2 border border-border flex items-center justify-between">
                                            <span className="text-muted-text font-semibold">Verification</span>
                                            <span className="text-main font-bold">{prev.verification || '-'}</span>
                                        </div>
                                        <div className="bg-[var(--background)]/80 rounded-xl p-2 border border-border flex items-center justify-between">
                                            <span className="text-muted-text font-semibold">Certificates</span>
                                            <span className="text-main font-bold">{prev.certificates || '-'}</span>
                                        </div>
                                        <div className="bg-[var(--background)]/80 rounded-xl p-2 border border-border flex items-center justify-between">
                                            <span className="text-muted-text font-semibold">Fee Status</span>
                                            <span className="text-main font-bold">{prev.fee || '-'}</span>
                                        </div>
                                        <div className="bg-[var(--background)]/80 rounded-xl p-2 border border-border flex items-center justify-between">
                                            <span className="text-muted-text font-semibold">Promotion</span>
                                            <span className="text-main font-bold">{prev.promotion || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="bg-surface rounded-2xl border border-border p-4 text-center">
                                <span className="text-sm font-black text-muted-text">-</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Overlay */}
            {activeStepId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h2 className="text-2xl font-bold text-main flex items-center gap-3">
                                {React.createElement(steps.find(s => s.id === activeStepId).icon, { className: 'text-primary' })}
                                {steps.find(s => s.id === activeStepId).title}
                            </h2>
                            <button
                                onClick={() => setActiveStepId(null)}
                                className="p-2 hover:bg-background rounded-full transition-colors text-muted-text"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Content based on Step ID */}

                            {/* STEP 1: VERIFICATION */}
                            {activeStepId === 1 && (
                                <div className="space-y-6">
                                    <div className="flex justify-center">
                                        <RegistrationStageBadge display={registrationStages.verification.display} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-4 bg-background rounded-xl border border-border">
                                            <label className="text-xs font-bold text-muted-text uppercase tracking-wider block mb-2">Student Mobile</label>
                                            <div className="flex items-center gap-2 mb-4">
                                                <Smartphone size={18} className="text-muted-text" />
                                                <span className="font-mono text-sub">{verificationState.studentMobile || 'Not Found'}</span>
                                            </div>
                                            {!verificationState.studentVerified ? (
                                                verificationState.studentOtpSent ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            className="w-full p-2 border rounded text-center font-mono"
                                                            placeholder="OTP"
                                                            maxLength={6}
                                                            value={verificationState.studentOtp}
                                                            onChange={e => setVerificationState({ ...verificationState, studentOtp: e.target.value })}
                                                        />
                                                        <button onClick={() => handleVerifyOTP('student')} className="bg-success text-white px-3 rounded hover:bg-success">Verify</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => handleSendOTP('student')} disabled={loading} className="w-full py-2 bg-[var(--primary-light)] text-primary rounded-lg hover:bg-[var(--primary-light)] font-medium text-sm">Send OTP</button>
                                                )
                                            ) : (
                                                <div className="w-full py-2 bg-[var(--success-light)] text-success rounded-lg flex items-center justify-center gap-2 font-medium text-sm"><CheckCircle size={16} /> Verified</div>
                                            )}
                                        </div>

                                        <div className="p-4 bg-background rounded-xl border border-border">
                                            <label className="text-xs font-bold text-muted-text uppercase tracking-wider block mb-2">Parent Mobile</label>
                                            <div className="flex items-center gap-2 mb-4">
                                                <Phone size={18} className="text-muted-text" />
                                                <span className="font-mono text-sub">{verificationState.parentMobile || 'Not Found'}</span>
                                            </div>
                                            {!verificationState.parentVerified ? (
                                                verificationState.parentOtpSent ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            className="w-full p-2 border rounded text-center font-mono"
                                                            placeholder="OTP"
                                                            maxLength={6}
                                                            value={verificationState.parentOtp}
                                                            onChange={e => setVerificationState({ ...verificationState, parentOtp: e.target.value })}
                                                        />
                                                        <button onClick={() => handleVerifyOTP('parent')} className="bg-success text-white px-3 rounded hover:bg-success">Verify</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => handleSendOTP('parent')} disabled={loading} className="w-full py-2 bg-[var(--primary-light)] text-primary rounded-lg hover:bg-[var(--primary-light)] font-medium text-sm">Send OTP</button>
                                                )
                                            ) : (
                                                <div className="w-full py-2 bg-[var(--success-light)] text-success rounded-lg flex items-center justify-center gap-2 font-medium text-sm"><CheckCircle size={16} /> Verified</div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-center text-muted-text">Both verifications are required to proceed.</p>
                                </div>
                            )}

                            {/* STEP 2: CERTIFICATES */}
                            {activeStepId === 2 && (
                                <div className="space-y-4">
                                    <div className="flex flex-col items-center justify-center mb-1">
                                        <RegistrationStageBadge display={registrationStages.certificates.display} />
                                        <p className="text-xs text-muted-text mt-2 font-medium">
                                            Current Status: <span className="font-bold text-main capitalize">{studentData?.certificates_status || 'Pending'}</span>
                                        </p>
                                    </div>

                                    {/* Certificates List */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-muted-text px-1">
                                            Academic Certificates & Documents
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {certificatesList.map(cert => (
                                                <div
                                                    key={cert.key}
                                                    className="bg-[var(--background)]/90 border border-border rounded-xl p-3 flex items-center justify-between shadow-2xs"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                            cert.isVerified ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--warning-light)] text-warning'
                                                        }`}>
                                                            <FileText size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-main truncate" title={cert.label}>
                                                                {cert.label}
                                                            </p>
                                                            <p className="text-[10px] text-muted-text font-medium">
                                                                Document Verification
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                                                        cert.isVerified
                                                            ? 'bg-[var(--success-light)] text-success'
                                                            : 'bg-[var(--warning-light)] text-warning'
                                                    }`}>
                                                        {cert.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {!isStepCompleted(2) && (
                                        <div className="bg-[var(--warning-light)] text-warning p-4 rounded-xl text-left border border-[var(--warning-light)] text-xs">
                                            <h4 className="font-bold mb-1.5 flex items-center gap-1.5"><AlertCircle size={16} /> Action Required</h4>
                                            <p>Please submit any pending original documents to the administration office for verification.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 3: FEE STATUS */}
                            {activeStepId === 3 && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-sub">Current Fee Status</h3>
                                        <button onClick={fetchStudentDetails} className="text-primary text-sm hover:underline flex items-center gap-1"><RefreshCw size={14} /> Refresh</button>
                                    </div>

                                    <div className={`p-6 rounded-xl border text-center ${isStepCompleted(3) ? 'bg-[var(--success-light)] border-[var(--success-light)]' : 'bg-[var(--danger-light)] border-[var(--danger-light)]'}`}>
                                        <div className="flex justify-center mb-3">
                                            <RegistrationStageBadge display={registrationStages.fee.display} />
                                        </div>
                                        <span className={`text-lg font-medium ${isStepCompleted(3) ? 'text-success' : 'text-danger'} capitalize block`}>
                                            {studentData?.fee_status ? studentData.fee_status.replace(/_/g, ' ') : 'Pending'}
                                        </span>
                                        <p className="text-muted-text text-sm mt-2">
                                            {isStepCompleted(3) ? 'You are cleared for registration.' : 'Please clear your dues to proceed.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: PROMOTION */}
                            {activeStepId === 4 && (
                                <div className="space-y-4">
                                    <div className="bg-background p-6 rounded-xl border border-border">
                                        <p className="text-sm text-muted-text uppercase tracking-wider font-bold">Current Academic Stand</p>
                                        <div className="mt-2 flex items-baseline gap-2">
                                            <span className="text-3xl font-bold text-main">Year {studentData?.current_year || 1}</span>
                                            <span className="text-xl text-sub">Semester {studentData?.current_semester || 1}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                            Year {studentData?.current_year || 1} • Sem {studentData?.current_semester || 1}
                                        </span>
                                        <RegistrationStageBadge display={registrationStages.promotion.display} />
                                    </div>
                                    <div className="bg-[var(--primary-light)] p-6 rounded-xl border border-[var(--primary-light)] flex items-start gap-3">
                                        <Zap className="text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-primary">Current semester placement</h4>
                                            <p className="text-primary text-sm mt-1">
                                                You are registered for the year and semester shown above.
                                                Complete the other registration steps to finish semester registration.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 5: SCHOLARSHIP */}
                            {activeStepId === 5 && (
                                <div className="text-center py-8">
                                    <Award size={48} className="text-primary mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-main">Scholarship Status</h3>
                                    <p className="text-xs text-muted-text mb-2">
                                        {usesSemesterWiseScholarshipStatus(studentData?.batch, studentData?.current_year || 1)
                                            ? `Year ${studentData?.current_year || 1} • Semester ${studentData?.current_semester || 1}`
                                            : `Year ${studentData?.current_year || 1}`}
                                    </p>
                                    <div className="flex justify-center my-4">
                                        <RegistrationStageBadge display={registrationStages.scholarship.display} />
                                    </div>

                                    {/* Fee Paid indicator — shown only for CONV quota + not_eligible semester */}
                                    {(() => {
                                        const currentYear = Number(studentData?.current_year) || 1;
                                        const currentSemester = Number(studentData?.current_semester) || 1;
                                        const yearData = scholarshipData?.years?.find(
                                            (y) => Number(y.student_year) === currentYear
                                        );
                                        const semRow = yearData?.semesters?.find(
                                            (s) => Number(s.student_semester) === currentSemester
                                        );
                                        const status = String(semRow?.eligible || '').trim().toLowerCase();
                                        const isConv = (studentData?.stud_type || '').toUpperCase() === 'CONV'
                                            || (studentData?.stud_type || '').toUpperCase() === 'CQ';
                                        const isNotEligible = status === 'not_eligible';
                                        if (!isConv || !isNotEligible) return null;

                                        const feePaid = semRow?.fee_paid === 1 || semRow?.fee_paid === true
                                            || scholarshipData?.currentSemesterFeePaid === true;

                                        return (
                                            <div className={`mx-auto max-w-xs mt-2 mb-4 px-4 py-2.5 rounded-xl border flex items-center gap-3 ${
                                                feePaid
                                                    ? 'bg-[var(--success-light)] border-[var(--success-light)] text-success'
                                                    : 'bg-[var(--warning-light)] border-[var(--warning-light)] text-warning'
                                            }`}>
                                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded border-2 flex-shrink-0 ${
                                                    feePaid ? 'bg-success border-success' : 'bg-surface border-warning'
                                                }`}>
                                                    {feePaid && (
                                                        <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none">
                                                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <div className="text-left">
                                                    <p className="text-xs font-bold">Fee Paid</p>
                                                    <p className="text-xs">{feePaid ? 'Fee has been marked as paid.' : 'Fee payment not yet confirmed by admin.'}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {!registrationStages.scholarship.completed && (
                                        <div className="mt-4 bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-xl p-4 text-left">
                                            <p className="text-sm font-semibold text-warning flex items-center gap-2">
                                                <AlertCircle size={16} /> Pending Action
                                            </p>
                                            <p className="text-sm text-warning mt-1">
                                                {(() => {
                                                    const currentYear = Number(studentData?.current_year) || 1;
                                                    const currentSemester = Number(studentData?.current_semester) || 1;
                                                    const yearData = scholarshipData?.years?.find(
                                                        (y) => Number(y.student_year) === currentYear
                                                    );
                                                    const semRow = yearData?.semesters?.find(
                                                        (s) => Number(s.student_semester) === currentSemester
                                                    );
                                                    const status = String(semRow?.eligible || '').trim().toLowerCase();
                                                    const isConv = (studentData?.stud_type || '').toUpperCase() === 'CONV'
                                                        || (studentData?.stud_type || '').toUpperCase() === 'CQ';
                                                    const isNotEligible = status === 'not_eligible';
                                                    const feePaid = semRow?.fee_paid === 1 || semRow?.fee_paid === true
                                                        || scholarshipData?.currentSemesterFeePaid === true;

                                                    if (isConv && isNotEligible && !feePaid) {
                                                        return 'Your scholarship is marked not eligible but fee payment has not been confirmed yet. Please contact the admin office.';
                                                    }
                                                    return 'Your scholarship status for this semester has not been set yet. Please contact the admin office to get it assigned.';
                                                })()}
                                            </p>
                                        </div>
                                    )}
                                    {registrationStages.scholarship.completed && (
                                        <p className="text-muted-text text-sm mt-2">
                                            Your scholarship status is recorded. No further action needed.
                                        </p>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border bg-background flex justify-end">
                            <button
                                onClick={async () => {
                                    if (activeStepId === 4 && user?.admission_number) {
                                        try {
                                            await api.post(`/students/${encodeURIComponent(user.admission_number)}/registration/acknowledge-promotion`);
                                            await fetchStudentDetails();
                                        } catch (error) {
                                            console.error('Promotion acknowledge error:', error);
                                            toast.error(error.response?.data?.message || 'Failed to save promotion acknowledgement');
                                            return;
                                        }
                                    }
                                    setActiveStepId(null);
                                }}
                                className="px-6 py-2 bg-sidebar text-white rounded-lg font-medium hover:bg-sidebar transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SemesterRegistration;
