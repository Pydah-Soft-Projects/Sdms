import React, { useEffect, useState, useMemo } from 'react';
import {
    Clock,
    Calendar,
    BookOpen,
    AlertCircle,
    Info,
    Award,
    CheckCircle,
    XCircle,
    TrendingUp,
    RefreshCw,
    Filter,
    UserCheck,
    ChevronRight,
    ChevronLeft,
    Layers,
    ShieldCheck
} from 'lucide-react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';
import { toast } from 'react-hot-toast';

const StudentTimetable = () => {
    const { user } = useAuthStore();

    // Data States
    const [timetableData, setTimetableData] = useState([]);
    const [periodSlots, setPeriodSlots] = useState([]);
    const [attendanceData, setAttendanceData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters, Tabs & Modal
    const [selectedYear, setSelectedYear] = useState(Number(user?.current_year) || 1);
    const [selectedSem, setSelectedSem] = useState(Number(user?.current_semester) || 1);
    const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'periodwise' | 'academic'
    const [selectedPeriodModal, setSelectedPeriodModal] = useState(null);
    const [isCalendarView, setIsCalendarView] = useState(false);
    const [calendarMonthDate, setCalendarMonthDate] = useState(new Date());

    const openPeriodModal = (entry, slot, day) => {
        setSelectedPeriodModal({ entry, slot, day });
        setIsCalendarView(false);
    };

    const days = ['MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];

    // Real-time Clock State for highlighting current period
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const currentSlotRef = React.useRef(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 15000); // 15 seconds real-time tick
        return () => clearInterval(timer);
    }, []);

    // Default active day for mobile/periodwise
    const today = new Date().getDay();
    const defaultDay = today >= 1 && today <= 6 ? days[today - 1] : 'MON';
    const [activeDay, setActiveDay] = useState(defaultDay);

    // Responsive screen check for clean mobile view separation
    const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobileScreen(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sync user default year/sem on load
    useEffect(() => {
        if (user?.current_year) setSelectedYear(Number(user.current_year) || 1);
        if (user?.current_semester) setSelectedSem(Number(user.current_semester) || 1);
    }, [user]);

    const normalizeSlotTimings = (rawSlots) => {
        if (!Array.isArray(rawSlots) || rawSlots.length === 0) return [];
        return rawSlots.map(slot => ({
            ...slot,
            id: slot.id ?? slot.sort_order ?? slot.slot_order ?? 1,
            sort_order: slot.sort_order ?? slot.slot_order ?? slot.id ?? 1,
            slot_name: slot.slot_name || slot.name || slot.label || `P${slot.sort_order || slot.slot_order || slot.id || ''}`,
            start_time: slot.start_time || '',
            end_time: slot.end_time || '',
            slot_type: slot.slot_type || ''
        }));
    };

    // Effective period slots without hardcoding - dynamically derived from API or timetable data
    const effectiveSlots = useMemo(() => {
        if (Array.isArray(periodSlots) && periodSlots.length > 0) {
            return periodSlots;
        }
        if (Array.isArray(timetableData) && timetableData.length > 0) {
            const slotMap = new Map();
            timetableData.forEach(item => {
                const order = Number(item.slot_order || item.slot_order_id || item.period_slot_id || 1);
                const label = item.slot_label || `P${order}`;
                if (!slotMap.has(order)) {
                    slotMap.set(order, {
                        id: item.period_slot_id || item.timing_slot_id || order,
                        sort_order: order,
                        slot_order: order,
                        slot_name: label,
                        name: label,
                        start_time: item.start_time || '',
                        end_time: item.end_time || '',
                        slot_type: item.type || 'period'
                    });
                }
            });
            const extracted = Array.from(slotMap.values()).sort((a, b) => a.sort_order - b.sort_order);
            if (extracted.length > 0) return extracted;
        }
        return [];
    }, [periodSlots, timetableData]);

    // Check if at least one academic subject is scheduled in timetableData
    const hasAnyClasses = useMemo(() => {
        return Array.isArray(timetableData) && timetableData.some(item => 
            Boolean(item && (item.subject_name || item.subject_code || (item.custom_label && !String(item.custom_label).toLowerCase().includes('break'))))
        );
    }, [timetableData]);

    // Fetch Timetable & Period Slots
    const fetchTimetableAndSlots = async (isManualRefresh = false) => {
        const branchId = user?.branch_id || user?.course_branch_id || user?.branchId;
        const collegeId = user?.college_id || user?.collegeId;

        try {
            if (isManualRefresh) setRefreshing(true);
            else setLoading(true);

            // 1. Fetch Default Period Slots
            const slotsRes = await api.get('/period-slots', {
                params: collegeId ? { college_id: collegeId } : {}
            });
            if (slotsRes.data?.success && Array.isArray(slotsRes.data.data)) {
                setPeriodSlots(normalizeSlotTimings(slotsRes.data.data));
            }

            // 2. Fetch Timetable for Selected Year & Semester strictly from Academic Portal
            const timetableRes = await api.get('/timetable/my-timetable', {
                params: {
                    branch_id: branchId,
                    branch: user?.branch,
                    year: selectedYear,
                    semester: selectedSem
                }
            }).catch(async () => {
                return await api.get('/timetable', {
                    params: {
                        branch_id: branchId,
                        branch: user?.branch,
                        year: selectedYear,
                        semester: selectedSem
                    }
                });
            });

            if (timetableRes?.data?.success) {
                setTimetableData(timetableRes.data.data || []);
                // If the Academic Portal timetable plan has dedicated timing template slots, prioritize them
                if (Array.isArray(timetableRes.data.slots) && timetableRes.data.slots.length > 0) {
                    setPeriodSlots(normalizeSlotTimings(timetableRes.data.slots));
                }
            }

            // 3. Fetch Academic Attendance Summary
            try {
                const attRes = await api.get('/attendance/student');
                if (attRes.data?.success) {
                    setAttendanceData(attRes.data.data || null);
                }
            } catch (attErr) {
                console.warn('Notice: Attendance summary endpoint unavailable:', attErr?.message);
            }

            if (isManualRefresh) toast.success('Timetable & Attendance refreshed!');
        } catch (error) {
            console.error('Failed to fetch timetable data:', error);
            toast.error('Failed to load timetable details');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTimetableAndSlots();
    }, [user, selectedYear, selectedSem]);

    // Time Format Helper
    const formatTimeTo12h = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        let h = parseInt(hours, 10);
        const m = minutes;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${m} ${ampm}`;
    };

    const normalizeDay = (d) => {
        if (!d) return '';
        const str = String(d).trim().toUpperCase();
        if (str.startsWith('MON')) return 'MON';
        if (str.startsWith('TUE')) return 'TUE';
        if (str.startsWith('WED')) return 'WED';
        if (str.startsWith('THU')) return 'THUR';
        if (str.startsWith('FRI')) return 'FRI';
        if (str.startsWith('SAT')) return 'SAT';
        if (str.startsWith('SUN')) return 'SUN';
        return str;
    };

    const getEntryForSlot = (day, slotObj, slotIndex) => {
        if (!slotObj) return undefined;
        const targetId = Number(typeof slotObj === 'object' ? (slotObj.id ?? slotObj.sort_order ?? slotObj.slot_order) : slotObj);
        const targetSortOrder = Number(typeof slotObj === 'object' ? (slotObj.sort_order ?? slotObj.slot_order ?? slotObj.id) : slotObj);
        const targetLabel = String(typeof slotObj === 'object' ? (slotObj.slot_name || slotObj.name || '') : '').trim().toUpperCase();

        return timetableData.find(item => {
            const itemDay = normalizeDay(item.day_of_week || item.day);
            const targetDay = normalizeDay(day);
            if (itemDay !== targetDay) return false;

            const itemSlotId = Number(item.period_slot_id || item.timing_slot_id || item.slot_id);
            const itemSlotOrder = Number(item.slot_order || item.slot_order_id || item.period_slot_id);
            const itemLabel = String(item.slot_label || item.label || '').trim().toUpperCase();

            return (
                (itemSlotId && (itemSlotId === targetId || itemSlotId === targetSortOrder)) ||
                (itemSlotOrder && (itemSlotOrder === targetSortOrder || itemSlotOrder === targetId)) ||
                (slotIndex != null && itemSlotOrder === (slotIndex + 1)) ||
                (targetLabel && itemLabel && targetLabel === itemLabel)
            );
        });
    };

    const getMobileEntryForSlot = (day, slotIndex) => {
        const slot = effectiveSlots[slotIndex];
        const exactEntry = getEntryForSlot(day, slot, slotIndex);
        if (exactEntry) return { ...exactEntry, isStart: true };

        for (let i = 0; i < slotIndex; i++) {
            const prevEntry = getEntryForSlot(day, effectiveSlots[i], i);
            if (prevEntry && prevEntry.span > (slotIndex - i)) {
                return { ...prevEntry, isCovered: true };
            }
        }
        return null;
    };

    const currentDayName = useMemo(() => {
        const d = currentTime.getDay();
        const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];
        return dayMap[d];
    }, [currentTime]);

    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return null;
        const s = String(timeStr).trim().toUpperCase();
        const isPm = s.includes('PM');
        const isAm = s.includes('AM');
        const cleanStr = s.replace(/AM|PM/g, '').trim();
        const parts = cleanStr.split(':');
        if (parts.length < 2) return null;
        let hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(minutes)) return null;
        if (isPm && hours < 12) hours += 12;
        if (isAm && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const isSlotCurrent = (slot, day) => {
        if (!slot || !slot.start_time || !slot.end_time) return false;
        if (normalizeDay(day) !== normalizeDay(currentDayName)) return false;

        const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
        const startMins = parseTimeToMinutes(slot.start_time);
        const endMins = parseTimeToMinutes(slot.end_time);

        if (startMins === null || endMins === null) return false;
        return currentMins >= startMins && currentMins < endMins;
    };

    // Direct Academic Portal Attendance Summary (strictly as provided by Academic Portal)
    const academicAttendanceSummary = useMemo(() => {
        const semesterData = attendanceData?.semester;
        const totals = semesterData?.totals || attendanceData?.totals || attendanceData;

        const rawPct = totals?.percentage ?? totals?.overallPercentage ?? totals?.attendance_percentage;
        const present = totals?.present ?? totals?.presentDays ?? totals?.present_count ?? 0;
        const absent = totals?.absent ?? totals?.absentDays ?? totals?.absent_count ?? 0;
        const holidays = totals?.holidays ?? totals?.holidayDays ?? 0;
        const workingDays = totals?.workingDays ?? totals?.totalWorkingDays ?? (present + absent);

        let numericPct = 0;
        if (rawPct !== undefined && rawPct !== null && Number(rawPct) > 0) {
            numericPct = Number(rawPct);
        } else if ((present + absent) > 0) {
            numericPct = (present / (present + absent)) * 100;
        } else {
            numericPct = 0.0;
        }

        return {
            percentage: numericPct.toFixed(1),
            present,
            absent,
            holidays,
            workingDays,
            status: numericPct >= 75 ? 'Compliant' : 'Shortage Alert',
            color: numericPct >= 75 ? 'text-primary' : 'text-danger',
            badgeBg: numericPct >= 75 ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--danger-light)] text-danger'
        };
    }, [attendanceData]);

    // Period-wise posted attendance logs from Academic Portal DB (ap_attendance_post_students)
    const periodWiseLogs = useMemo(() => {
        return attendanceData?.periodWiseLogs || attendanceData?.semester?.periodWiseLogs || [];
    }, [attendanceData]);

    // Compute Subject-Wise Attendance from Academic Portal Series & Timetable Schedule
    const subjectAttendanceStatsMap = useMemo(() => {
        const statsMap = new Map();
        const series = attendanceData?.semester?.series || attendanceData?.series || [];

        // 1. Group timetable entries by subject code/title to find scheduled days & slot times
        const subjectDaysMap = new Map();
        timetableData.forEach(item => {
            const title = item.subject_name || item.custom_label || item.title || item.name;
            if (title) {
                const key = (item.subject_code || title).trim().toUpperCase();
                const day = normalizeDay(item.day_of_week || item.day);
                const slotLabel = item.slot_label || (item.start_time ? `${formatTimeTo12h(item.start_time)}` : null);
                if (!subjectDaysMap.has(key)) {
                    subjectDaysMap.set(key, {
                        name: title,
                        code: item.subject_code || (title ? title.replace(/\s+/g, '-').substring(0, 10).toUpperCase() : 'SUB-101'),
                        days: new Set(),
                        slotLabels: new Set(),
                        faculty: item.faculty_name || item.teacher_name || item.faculty || item.staff_name || item.instructor_name || null,
                        slotsCount: 0
                    });
                }
                const existing = subjectDaysMap.get(key);
                if (day) existing.days.add(day);
                if (slotLabel) existing.slotLabels.add(slotLabel);
                existing.slotsCount += item.span || 1;
                if (!existing.faculty && (item.faculty_name || item.teacher_name || item.faculty || item.staff_name)) {
                    existing.faculty = item.faculty_name || item.teacher_name || item.faculty || item.staff_name;
                }
            }
        });

        // 2. Compute attendance for each subject strictly from slot-based periodWiseLogs (Academic Portal DB)
        subjectDaysMap.forEach((info, key) => {
            let total = 0;
            let present = 0;
            let absent = 0;

            // Direct match from ap_attendance_post_students period-wise logs
            const directLogs = periodWiseLogs.filter(log => {
                const codeMatch = log.subject_code && log.subject_code.trim().toUpperCase() === info.code.trim().toUpperCase();
                const nameMatch = log.subject_name && log.subject_name.trim().toUpperCase() === info.name.trim().toUpperCase();
                return codeMatch || nameMatch;
            });

            if (directLogs.length > 0) {
                directLogs.forEach(log => {
                    if (log.status === 'present') present++;
                    else if (log.status === 'absent') absent++;
                    if (log.faculty_name && !info.faculty) {
                        info.faculty = log.faculty_name;
                    }
                });
                total = present + absent;
            }

            // Strictly slot-based: If no slot-based attendance posted, percentage is 0.0
            const pct = total > 0 ? (present / total) * 100 : 0.0;
            const scheduledDaysStr = Array.from(info.days).join(', ');
            const slotLabelsStr = Array.from(info.slotLabels).join(', ');

            statsMap.set(key, {
                name: info.name,
                code: info.code,
                slotsCount: info.slotsCount,
                daysStr: scheduledDaysStr,
                slotLabelsStr: slotLabelsStr,
                faculty: info.faculty || 'Department Faculty',
                present,
                absent,
                total,
                percentage: Number(pct).toFixed(1),
                status: pct >= 75 ? 'Compliant' : 'Shortage Alert'
            });
        });

        return statsMap;
    }, [timetableData, attendanceData, academicAttendanceSummary, periodWiseLogs]);

    const timetableSubjects = useMemo(() => {
        return Array.from(subjectAttendanceStatsMap.values());
    }, [subjectAttendanceStatsMap]);

    if (loading) {
        return (
            <div className="space-y-6 max-w-[1920px] mx-auto px-3 sm:px-4 md:px-6 pb-8 animate-pulse">
                <div className="bg-surface rounded-2xl sm:rounded-[2.5rem] p-6 border border-border space-y-3">
                    <SkeletonBox height="h-8" width="w-64" className="rounded-xl" />
                    <SkeletonBox height="h-4" width="w-48" />
                </div>
                <div className="flex gap-2">
                    <SkeletonBox height="h-10" width="w-32" className="rounded-xl" />
                    <SkeletonBox height="h-10" width="w-32" className="rounded-xl" />
                    <SkeletonBox height="h-10" width="w-32" className="rounded-xl" />
                </div>
                <SkeletonBox height="h-96" className="w-full rounded-2xl" />
            </div>
        );
    }

    const TimetableCard = ({ entry, slot, day, isMobile = false, postedSlotLog = null, isToday = false, isCurrent = false, onClick }) => {
        const sName = String(slot?.slot_name || slot?.name || slot?.label || '').trim().toUpperCase();
        const sOrder = Number(slot?.sort_order ?? slot?.id ?? 0);
        const startTime = String(slot?.start_time || '');
        const slotType = String(slot?.slot_type || '').toLowerCase();
        const isBreakSlot = 
            slotType === 'break' || 
            slotType === 'lunch' || 
            sName.includes('BREAK') || 
            sName.includes('LUNCH') ||
            (entry && (String(entry.type || '').toLowerCase() === 'break' || String(entry.type || '').toLowerCase() === 'lunch'));

        const entryType = String(entry?.type || '').toLowerCase();
        const isLab = entryType === 'lab';
        const isBreak = entryType === 'break' || entryType === 'lunch' || isBreakSlot;
        const isOther = entryType === 'other';

        let badgeText = String(entry?.type || '').toUpperCase();
        if (!entry) {
            badgeText = isBreakSlot ? (sName.includes('LUNCH') || slotType === 'lunch' ? 'LUNCH BREAK' : 'BREAK') : 'FREE SLOT';
        } else if (!badgeText || badgeText === 'SUBJECT' || badgeText === 'THEORY') {
            badgeText = 'THEORY';
        }

        let badgeStyle = 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]';
        let barColor = 'bg-primary';
        let periodBadgeStyle = 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]';
        let timeColor = 'text-primary';

        if (postedSlotLog) {
            if (postedSlotLog.status === 'present') {
                badgeText = `${badgeText} • PRESENT`;
                badgeStyle = 'bg-[var(--success-light)] text-success border-[var(--success-light)]';
            } else if (postedSlotLog.status === 'absent') {
                badgeText = `${badgeText} • ABSENT`;
                badgeStyle = 'bg-[var(--danger-light)] text-danger border-[var(--danger-light)]';
            }
        } else if (isLab) {
            badgeStyle = 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]';
            barColor = 'bg-secondary';
            periodBadgeStyle = 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]';
            timeColor = 'text-secondary';
        } else if (isBreak) {
            badgeStyle = 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]';
            barColor = 'bg-warning';
            periodBadgeStyle = 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]';
            timeColor = 'text-warning';
        } else if (isOther) {
            badgeStyle = 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]';
            barColor = 'bg-primary';
            periodBadgeStyle = 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]';
            timeColor = 'text-primary';
        } else if (!entry) {
            badgeStyle = 'bg-background text-muted-text border-border';
            barColor = 'bg-background';
            periodBadgeStyle = 'bg-background text-sub border-border';
            timeColor = 'text-muted-text';
        }

        const titleText = entry
            ? (entry.subject_name || entry.custom_label || entry.title || entry.name || (entry.type ? `${entry.type}` : 'Subject Class'))
            : (isBreakSlot ? (sName.includes('LUNCH') || slotType === 'lunch' ? 'Lunch Break' : 'Break') : 'Free Period Slot');

        const codeOrLabel = entry?.subject_code || (entry?.subject_name ? entry?.custom_label : null) || slot?.slot_name || 'Class';
        const facultyName = postedSlotLog?.faculty_name || entry?.faculty_name || entry?.teacher_name || entry?.faculty || entry?.staff_name;

        // Mobile & Responsive Clean Card Layout
        if (isMobile) {
            if (isBreak) {
                return (
                    <div className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl border shadow-2xs transition-all ${
                        isCurrent
                            ? 'bg-[var(--warning-light)] border-warning ring-2 ring-warning shadow-md text-warning font-bold'
                            : 'bg-[var(--warning-light)] border-[var(--warning-light)] text-warning'
                    }`}>
                        <div className="flex items-center gap-2 text-xs font-bold">
                            <span className="text-sm">{sName.includes('LUNCH') || slotType === 'lunch' ? '🍱' : '☕'}</span>
                            <span className="font-extrabold uppercase tracking-wide text-[10px]">
                                {sName.includes('LUNCH') || slotType === 'lunch' ? 'Lunch Break' : 'Short Break'}
                            </span>
                            {isCurrent && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-warning text-white shadow-2xs animate-pulse leading-none">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-surface opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-surface"></span>
                                    </span>
                                    NOW
                                </span>
                            )}
                        </div>
                        <span className={`text-[10px] font-bold whitespace-nowrap ${isCurrent ? 'text-warning font-black' : 'text-warning'}`}>
                            {formatTimeTo12h(slot?.start_time)} {slot?.end_time ? `– ${formatTimeTo12h(slot?.end_time)}` : ''}
                        </span>
                    </div>
                );
            }

            if (!entry) {
                return (
                    <div className={`w-full flex items-center justify-between py-2 px-3 rounded-xl border shadow-2xs transition-all ${
                        isCurrent
                            ? 'border-primary ring-2 ring-primary bg-[var(--primary-light)] text-primary shadow-md'
                            : 'border-dashed border-border bg-[var(--background)]/40 text-muted-text'
                    }`}>
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${isCurrent ? 'bg-primary text-white' : 'bg-[var(--background)]/70 text-sub'}`}>
                                {slot?.slot_name || `P${sOrder || ''}`}
                            </span>
                            {isCurrent && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-primary text-white shadow-2xs animate-pulse leading-none">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-surface opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-surface"></span>
                                    </span>
                                    NOW
                                </span>
                            )}
                            <span className={`text-[10px] font-medium truncate ${isCurrent ? 'text-primary font-bold' : 'text-muted-text'}`}>
                                Free Period / Leisure Hour
                            </span>
                        </div>
                        <span className={`text-[10px] font-semibold shrink-0 whitespace-nowrap ${isCurrent ? 'text-primary font-bold' : 'text-muted-text'}`}>
                            {formatTimeTo12h(slot?.start_time)} {slot?.end_time ? `– ${formatTimeTo12h(slot?.end_time)}` : ''}
                        </span>
                    </div>
                );
            }

            const hasRealCode = entry?.subject_code && entry.subject_code.trim().toUpperCase() !== (slot?.slot_name || '').trim().toUpperCase();

            return (
                <div
                    onClick={() => onClick && onClick(entry, slot, day)}
                    className={`w-full rounded-xl border p-2.5 transition-all cursor-pointer group space-y-1.5 relative overflow-hidden ${
                        isCurrent
                            ? 'bg-gradient-to-r from-[var(--primary-light)] via-surface to-[var(--primary-light)] border-primary ring-2 ring-primary shadow-md shadow-primary/10'
                            : 'bg-surface border-border shadow-2xs hover:border-[var(--primary-light)]'
                    }`}
                    title="Click to view teacher & subject attendance details"
                >
                    {isCurrent && (
                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-primary to-primary" />
                    )}

                    {/* Header Row: Period Badge + Times on left, Type Badge + Code on right */}
                    <div className={`flex items-center justify-between gap-1.5 ${isCurrent ? 'pl-1' : ''}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 ${isCurrent ? 'bg-primary text-white shadow-xs' : periodBadgeStyle}`}>
                                {slot?.slot_name || `P${sOrder || ''}`}
                            </span>
                            {isCurrent && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-success text-white shadow-xs animate-pulse leading-none shrink-0">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-surface opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-surface"></span>
                                    </span>
                                    NOW
                                </span>
                            )}
                            <span className={`text-[10px] whitespace-nowrap ${isCurrent ? 'font-bold text-primary' : 'font-semibold text-muted-text'}`}>
                                {formatTimeTo12h(slot?.start_time)} – {formatTimeTo12h(slot?.end_time)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${badgeStyle}`}>
                                {badgeText}
                            </span>
                            {hasRealCode && (
                                <span className="text-[9px] font-bold text-muted-text font-mono">
                                    {entry.subject_code}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Subject Title (small text, full width) */}
                    <h4 className={`text-xs leading-snug transition-colors line-clamp-2 ${isCurrent ? 'font-black text-primary group-hover:text-primary pl-1' : 'font-extrabold text-primary group-hover:text-primary'}`}>
                        {titleText}
                    </h4>

                    {/* Faculty Row */}
                    {facultyName && (
                        <div className={`flex items-center gap-1 text-[10px] font-semibold text-sub pt-1 border-t border-border truncate ${isCurrent ? 'pl-1' : ''}`}>
                            <UserCheck size={12} className="text-primary shrink-0" />
                            <span className="truncate">{facultyName}</span>
                        </div>
                    )}
                </div>
            );
        }

        // Desktop Grid Cell View
        if (!entry || isBreak) {
            if (isBreakSlot) {
                return (
                    <div className={`h-full w-full rounded-xl border flex flex-col items-center justify-center min-h-[105px] p-1.5 text-center transition-all ${
                        isCurrent
                            ? 'border-warning ring-2 ring-warning bg-[var(--warning-light)] shadow-md'
                            : 'border-[var(--warning-light)] bg-[var(--warning-light)]'
                    }`}>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                                BREAK
                            </span>
                            {isCurrent && (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-warning text-white animate-pulse">
                                    NOW
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-bold text-warning mt-1 leading-none">
                            {sName.includes('LUNCH') || slotType === 'lunch' ? 'Lunch Break' : 'Break'}
                        </span>
                    </div>
                );
            }

            return (
                <div className={`h-full w-full rounded-xl border flex flex-col items-center justify-center min-h-[105px] p-1.5 text-center transition-all ${
                    isCurrent
                        ? 'border-primary ring-2 ring-primary bg-[var(--primary-light)] shadow-md'
                        : 'border-border border-dashed bg-[var(--background)]/30'
                }`}>
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border text-muted-text border-border bg-surface">
                            FREE SLOT
                        </span>
                        {isCurrent && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-primary text-white animate-pulse">
                                NOW
                            </span>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div
                onClick={() => onClick && entry && onClick(entry, slot, day)}
                className={`h-full w-full rounded-xl flex flex-col justify-between border transition-all duration-200 group relative overflow-hidden cursor-pointer p-1.5 sm:p-2 min-h-[105px] ${
                    isCurrent
                        ? 'bg-[var(--primary-light)] border-primary ring-2 ring-primary shadow-lg scale-[1.01] z-10'
                        : isToday
                            ? 'bg-surface border-[var(--primary-light)] ring-1 ring-[var(--primary-light)] shadow-2xs hover:border-primary hover:shadow-md'
                            : 'bg-surface border-border hover:border-primary hover:shadow-md'
                }`}
                title={`${titleText} | Faculty: ${facultyName || 'Department Faculty'} (${codeOrLabel}) - Click for details`}
            >
                <div className={`absolute top-0 left-0 w-1 sm:w-1.5 h-full ${isCurrent ? 'bg-gradient-to-b from-primary to-primary' : barColor}`} />

                <div className="pl-1 sm:pl-1.5 space-y-0.5">
                    {/* Top Row: Type Badge + NOW badge + Subject Code Badge */}
                    <div className="flex items-center justify-between gap-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                            <span className={`text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider px-1 py-0.5 rounded border leading-none ${badgeStyle}`}>
                                {badgeText}
                            </span>
                            {isCurrent && (
                                <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-black uppercase bg-success text-white shadow-2xs animate-pulse leading-none shrink-0">
                                    <span className="relative flex h-1 w-1 rounded-full bg-surface"></span>
                                    NOW
                                </span>
                            )}
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-bold text-muted-text bg-background border border-border px-1 py-0.5 rounded truncate max-w-[60px] sm:max-w-[75px] leading-none" title={codeOrLabel}>
                            {codeOrLabel}
                        </span>
                    </div>

                    {/* Subject Title */}
                    <h4 className={`text-[10px] sm:text-xs leading-tight line-clamp-2 tracking-tight group-hover:text-primary transition-colors ${isCurrent ? 'font-black text-primary' : 'font-extrabold text-primary'}`} title={titleText}>
                        {titleText}
                    </h4>
                </div>

                {/* Bottom Row: Faculty Name spanning full width */}
                {facultyName && (
                    <div className="mt-1 pt-0.5 border-t border-border flex items-center gap-0.5 text-[9px] sm:text-[10px] font-extrabold text-primary pl-1 sm:pl-1.5 min-w-0" title={facultyName}>
                        <UserCheck className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{facultyName}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-3.5 sm:space-y-6 animate-fade-in w-full max-w-[1920px] mx-auto px-0 sm:px-4 md:px-6 pb-40 sm:pb-16 overflow-x-hidden">

            {/* ── Top Portal Header ── */}
            <header className="flex items-center justify-between gap-2.5 sm:gap-4 w-full shrink-0">
                <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-2xl font-black !text-primary heading-font leading-tight whitespace-nowrap truncate">
                        Academic Timetable &amp; Schedule
                    </h1>
                    <p className="text-[10px] sm:text-xs md:text-sm text-muted-text font-semibold mt-0.5 flex items-center gap-1.5 sm:gap-2 truncate">
                        <BookOpen size={13} className="text-primary shrink-0" />
                        <span>{user?.branch || 'Engineering'}</span>
                        <span className="text-muted-text">•</span>
                        <span>Year {selectedYear}</span>
                        <span className="text-muted-text">•</span>
                        <span>Sem {selectedSem}</span>
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
                    {/* Attendance Pill - Only visible on Desktop/Tablet */}
                    {!isMobileScreen && (
                        <div className="flex bg-surface border border-border px-3.5 sm:px-4 py-2 rounded-xl shadow-xs items-center gap-2.5 sm:gap-3 shrink-0">
                            <div className="p-1.5 sm:p-2 bg-[var(--primary-light)] text-primary rounded-lg shrink-0">
                                <Award size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] font-extrabold text-muted-text uppercase tracking-wider leading-none mb-1">Academic Attendance</p>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <span className="text-sm sm:text-base font-extrabold text-primary leading-none">{academicAttendanceSummary.percentage}%</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${academicAttendanceSummary.badgeBg}`}>
                                        {academicAttendanceSummary.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Refresh Button */}
                    <button
                        onClick={() => fetchTimetableAndSlots(true)}
                        disabled={refreshing}
                        className="flex p-2 sm:p-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-xs items-center justify-center shrink-0"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {/* ── View Navigation Tabs ── */}
            {isMobileScreen ? (
                /* Mobile Tabs: Compact, sleek segmented switch */
                <div className="bg-background p-1 rounded-xl w-full border border-border shadow-2xs">
                    <div className="grid grid-cols-3 gap-1 w-full">
                        <button
                            onClick={() => setActiveTab('grid')}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-center transition-all duration-150 ${
                                activeTab === 'grid'
                                    ? 'bg-primary text-white font-extrabold shadow-xs'
                                    : 'text-sub hover:text-main hover:bg-[var(--surface)]/60 font-semibold'
                            }`}
                        >
                            <Calendar size={12} className="shrink-0" />
                            <span className="text-[11px] font-bold truncate">Timetable</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('periodwise')}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-center transition-all duration-150 ${
                                activeTab === 'periodwise'
                                    ? 'bg-primary text-white font-extrabold shadow-xs'
                                    : 'text-sub hover:text-main hover:bg-[var(--surface)]/60 font-semibold'
                            }`}
                        >
                            <Clock size={12} className="shrink-0" />
                            <span className="text-[11px] font-bold truncate">Periods</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('academic')}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-center transition-all duration-150 ${
                                activeTab === 'academic'
                                    ? 'bg-primary text-white font-extrabold shadow-xs'
                                    : 'text-sub hover:text-main hover:bg-[var(--surface)]/60 font-semibold'
                            }`}
                        >
                            <TrendingUp size={12} className="shrink-0" />
                            <span className="text-[11px] font-bold truncate">Summary</span>
                        </button>
                    </div>
                </div>
            ) : (
                /* Desktop Tabs: Untouched inline layout */
                <div className="bg-[var(--background)]/90 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl w-fit shrink-0 shadow-xs">
                    <div className="inline-flex items-center gap-1 sm:gap-1.5">
                        <button
                            onClick={() => setActiveTab('grid')}
                            className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 text-center ${activeTab === 'grid'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-sub hover:text-main hover:bg-[var(--surface)]/50'
                                }`}
                        >
                            <Calendar size={14} className="shrink-0" />
                            <span>Semester Timetable (Grid)</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('periodwise')}
                            className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 text-center ${activeTab === 'periodwise'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-sub hover:text-main hover:bg-[var(--surface)]/50'
                                }`}
                        >
                            <Clock size={14} className="shrink-0" />
                            <span>Period-wise Breakdown</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('academic')}
                            className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 text-center ${activeTab === 'academic'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-sub hover:text-main hover:bg-[var(--surface)]/50'
                                }`}
                        >
                            <TrendingUp size={14} className="shrink-0" />
                            <span>Academic Summary</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ── TAB 1: SEMESTER TIMETABLE (GRID VIEW) ── */}
            {activeTab === 'grid' && (
                <div className={isMobileScreen ? "w-full" : "bg-surface rounded-2xl border border-border shadow-sm overflow-hidden w-full"}>
                    {!hasAnyClasses || effectiveSlots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 sm:p-20 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--warning-light)] border border-[var(--warning-light)] flex items-center justify-center text-warning mb-4 shadow-xs">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-black text-main mb-1.5">Timetable Not Configured</h3>
                            <p className="text-muted-text max-w-sm text-xs sm:text-sm">
                                Timetable for Year {selectedYear} Sem {selectedSem} has not been configured in the Academic Portal yet. Please contact your department HOD.
                            </p>
                        </div>
                    ) : isMobileScreen ? (
                        /* Mobile Timeline View - Full-width layout */
                        <div className="w-full space-y-2">
                            {/* Day selector: 6 equal columns, strictly NO horizontal scrolling */}
                            <div className="w-full bg-surface p-1 rounded-xl border border-border shadow-2xs">
                                <div className="grid grid-cols-6 gap-1 w-full">
                                    {days.map((day) => (
                                        <button
                                            key={day}
                                            onClick={() => setActiveDay(day)}
                                            className={`py-1.5 px-0.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex flex-col items-center justify-center min-w-0 text-center ${
                                                activeDay === day
                                                    ? 'bg-primary text-white shadow-xs'
                                                    : 'bg-background text-sub hover:bg-background'
                                            } ${day === currentDayName ? 'ring-1.5 ring-primary' : ''}`}
                                        >
                                            <span className="truncate">{day === 'THUR' ? 'THU' : day}</span>
                                            {day === currentDayName && (
                                                <span className={`text-[7px] font-black uppercase leading-none mt-0.5 ${
                                                    activeDay === day ? 'text-primary' : 'text-primary'
                                                }`}>
                                                    TODAY
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Clean Full-Width Timetable Cards List */}
                            <div className="space-y-2 w-full">
                                {effectiveSlots.map((slot, index) => {
                                    const entry = getEntryForSlot(activeDay, slot, index);
                                    const isCurrent = isSlotCurrent(slot, activeDay);
                                    return (
                                        <div
                                            key={slot.id || `grid-m-slot-${index}`}
                                            ref={isCurrent ? currentSlotRef : null}
                                        >
                                            <TimetableCard
                                                entry={entry}
                                                slot={slot}
                                                day={activeDay}
                                                isMobile
                                                isToday={activeDay === currentDayName}
                                                isCurrent={isCurrent}
                                                onClick={(entry, slot, day) => entry && openPeriodModal(entry, slot, day)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* Desktop Full Table Grid */
                        <div className="w-full overflow-x-auto">
                            <div className="min-w-[950px] w-full">
                                {/* Table Header Row: Days column + Period Slots */}
                                <div className="flex border-b border-border bg-[var(--background)]/80 w-full">
                                    <div className="w-20 sm:w-24 flex-shrink-0 p-3 flex items-center justify-center border-r border-border bg-[var(--background)]/70">
                                        <span className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-wider">DAYS</span>
                                    </div>
                                    <div
                                        className="flex-1 grid min-w-0"
                                        style={{ gridTemplateColumns: `repeat(${effectiveSlots.length}, minmax(0, 1fr))` }}
                                    >
                                        {effectiveSlots.map((slot, sIdx) => {
                                            const isCurrentSlotTiming = isSlotCurrent(slot, currentDayName);
                                            return (
                                                <div
                                                    key={slot.id || `h-slot-${sIdx}`}
                                                    className={`py-2.5 px-1.5 text-center border-r border-border last:border-r-0 flex flex-col justify-center min-w-0 transition-colors ${
                                                        isCurrentSlotTiming ? 'bg-[var(--primary-light)] border-b-2 border-b-primary' : 'bg-[var(--background)]/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-center gap-1 mb-0.5">
                                                        <p className={`text-[10px] sm:text-xs uppercase tracking-wider truncate ${isCurrentSlotTiming ? 'font-black text-primary' : 'font-black text-primary'}`}>{slot.slot_name}</p>
                                                        {isCurrentSlotTiming && (
                                                            <span className="px-1 py-0.2 rounded bg-primary text-white text-[7px] font-black uppercase tracking-wider animate-pulse leading-none">
                                                                NOW
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`text-[9px] sm:text-[10px] font-bold flex items-center justify-center gap-1 whitespace-nowrap truncate ${isCurrentSlotTiming ? 'text-primary' : 'text-sub'}`}>
                                                        <Clock size={11} className={isCurrentSlotTiming ? "text-primary shrink-0" : "text-primary shrink-0"} />
                                                        <span className="truncate">{formatTimeTo12h(slot.start_time).replace(' AM', '').replace(' PM', '')} - {formatTimeTo12h(slot.end_time)}</span>
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Table Body Rows: Each Day as a Row */}
                                <div className="divide-y divide-border w-full">
                                    {days.map((day) => (
                                        <div key={day} className={`flex transition-colors w-full ${day === currentDayName ? 'bg-[var(--primary-light)]' : 'hover:bg-[var(--background)]/40'}`}>
                                            <div className={`w-20 sm:w-24 flex-shrink-0 flex flex-col items-center justify-center border-r font-extrabold text-xs tracking-wider transition-all relative ${
                                                day === currentDayName 
                                                    ? 'bg-primary text-white border-r-primary shadow-sm'
                                                    : 'text-sub bg-[var(--background)]/50 border-border'
                                            }`}>
                                                <span>{day}</span>
                                                {day === currentDayName && (
                                                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-surface text-primary mt-1 shadow-2xs leading-none">
                                                        TODAY
                                                    </span>
                                                )}
                                            </div>

                                            <div
                                                className="flex-1 grid min-w-0"
                                                style={{ gridTemplateColumns: `repeat(${effectiveSlots.length}, minmax(0, 1fr))` }}
                                            >
                                                {effectiveSlots.map((slot, sIdx) => {
                                                    const entry = getEntryForSlot(day, slot, sIdx);
                                                    const isCurrent = isSlotCurrent(slot, day);
                                                    return (
                                                        <div
                                                            key={slot.id || `b-slot-${sIdx}`}
                                                            className={`p-1 min-h-[110px] flex border-r border-border last:border-r-0 min-w-0 ${isCurrent ? 'bg-[var(--primary-light)]' : ''}`}
                                                        >
                                                            <TimetableCard
                                                                entry={entry}
                                                                slot={slot}
                                                                day={day}
                                                                isToday={day === currentDayName}
                                                                isCurrent={isCurrent}
                                                                onClick={(entry, slot, day) => openPeriodModal(entry, slot, day)}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB 2: PERIOD-WISE BREAKDOWN ── */}
            {activeTab === 'periodwise' && (
                <div className={isMobileScreen ? "w-full space-y-2.5" : "bg-surface rounded-2xl border border-border p-4 sm:p-6 space-y-4 shadow-xs"}>
                    {!hasAnyClasses || effectiveSlots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 sm:p-20 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--warning-light)] border border-[var(--warning-light)] flex items-center justify-center text-warning mb-4 shadow-xs">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-black text-main mb-1.5">Timetable Not Configured</h3>
                            <p className="text-muted-text max-w-sm text-xs sm:text-sm">
                                Timetable for Year {selectedYear} Sem {selectedSem} has not been configured in the Academic Portal yet. Please contact your department HOD.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border w-full"
                                style={!isMobileScreen ? { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } : undefined}
                            >
                                <div className="text-left shrink-0">
                                    <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight leading-snug text-left">
                                        Period-wise Timetable Breakdown
                                    </h3>
                                    <p className="hidden sm:block text-xs text-muted-text font-medium mt-0.5 text-left">
                                        Select a day to view period schedule and posted teacher attendance details.
                                    </p>
                                </div>
                                {!isMobileScreen && (
                                    <div
                                        className="flex overflow-x-auto no-scrollbar gap-1.5 py-0.5 w-auto ml-auto shrink-0"
                                    >
                                        {days.map((day) => (
                                            <button
                                                key={day}
                                                onClick={() => setActiveDay(day)}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${activeDay === day
                                                    ? 'bg-primary text-white shadow-sm'
                                                    : 'bg-background text-sub hover:bg-background'
                                                    } ${day === currentDayName ? 'ring-2 ring-primary font-extrabold' : ''}`}
                                            >
                                                <span>{day}</span>
                                                {day === currentDayName && (
                                                    <span className={`text-[8px] font-black px-1 py-0.2 rounded uppercase ${activeDay === day ? 'bg-surface text-primary' : 'bg-primary text-white'}`}>
                                                        TODAY
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Mobile Day Selector for Tab 2 - NO horizontal scroll */}
                            {isMobileScreen && (
                                <div className="w-full bg-surface p-1 rounded-xl border border-border shadow-2xs">
                                    <div className="grid grid-cols-6 gap-1 w-full">
                                        {days.map((day) => (
                                            <button
                                                key={day}
                                                onClick={() => setActiveDay(day)}
                                                className={`py-1.5 px-0.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex flex-col items-center justify-center min-w-0 text-center ${
                                                    activeDay === day
                                                        ? 'bg-primary text-white shadow-xs'
                                                        : 'bg-background text-sub hover:bg-background'
                                                } ${day === currentDayName ? 'ring-1.5 ring-primary' : ''}`}
                                            >
                                                <span className="truncate">{day === 'THUR' ? 'THU' : day}</span>
                                                {day === currentDayName && (
                                                    <span className={`text-[7px] font-black uppercase leading-none mt-0.5 ${
                                                        activeDay === day ? 'text-primary' : 'text-primary'
                                                    }`}>
                                                        TODAY
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={isMobileScreen ? "space-y-2 w-full" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"}>
                                {effectiveSlots.map((slot, index) => {
                                    const entry = getEntryForSlot(activeDay, slot, index);
                                    const isCurrent = isSlotCurrent(slot, activeDay);

                                    // Find posted attendance log for this period from ap_attendance_post_students
                                    const postedSlotLog = periodWiseLogs.find(log => {
                                        const logDay = normalizeDay(log.day_of_week);
                                        const dayMatch = !logDay || logDay === normalizeDay(activeDay);
                                        const slotMatch = Number(log.period_slot_id) === Number(slot.id) || Number(log.timing_slot_id) === Number(slot.id);
                                        const codeMatch = entry?.subject_code && log.subject_code && log.subject_code.trim().toUpperCase() === entry.subject_code.trim().toUpperCase();
                                        return dayMatch && (slotMatch || codeMatch);
                                    });

                                    return (
                                        <div
                                            key={slot.id || `pw-slot-${index}`}
                                            ref={isCurrent ? currentSlotRef : null}
                                        >
                                            <TimetableCard
                                                entry={entry}
                                                slot={slot}
                                                day={activeDay}
                                                isMobile
                                                isToday={activeDay === currentDayName}
                                                isCurrent={isCurrent}
                                                postedSlotLog={postedSlotLog}
                                                onClick={(entry, slot, day) => entry && openPeriodModal(entry, slot, day)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── TAB 3: ACADEMIC SUMMARY ── */}
            {activeTab === 'academic' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                        <div className="bg-surface p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-border shadow-xs flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] sm:text-[10px] font-extrabold uppercase text-muted-text tracking-wider mb-0.5 sm:mb-1 truncate">Total Attendance %</p>
                                <h3 className="text-base sm:text-xl font-extrabold text-primary">{academicAttendanceSummary.percentage}%</h3>
                                <p className="text-[10px] sm:text-xs font-semibold text-success mt-0.5 truncate">Target: 75%</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-[var(--primary-light)] text-primary rounded-lg sm:rounded-xl shrink-0">
                                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                        </div>

                        <div className="bg-surface p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-border shadow-xs flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] sm:text-[10px] font-extrabold uppercase text-muted-text tracking-wider mb-0.5 sm:mb-1 truncate">Present Days</p>
                                <h3 className="text-base sm:text-xl font-extrabold text-success">{academicAttendanceSummary.present} Days</h3>
                                <p className="text-[10px] sm:text-xs font-semibold text-muted-text mt-0.5 truncate">Attended</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-[var(--success-light)] text-success rounded-lg sm:rounded-xl shrink-0">
                                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                        </div>

                        <div className="bg-surface p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-border shadow-xs flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] sm:text-[10px] font-extrabold uppercase text-muted-text tracking-wider mb-0.5 sm:mb-1 truncate">Absent Days</p>
                                <h3 className="text-base sm:text-xl font-extrabold text-danger">{academicAttendanceSummary.absent} Days</h3>
                                <p className="text-[10px] sm:text-xs font-semibold text-muted-text mt-0.5 truncate">Missed</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-[var(--danger-light)] text-danger rounded-lg sm:rounded-xl shrink-0">
                                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                        </div>

                        <div className="bg-surface p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-border shadow-xs flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] sm:text-[10px] font-extrabold uppercase text-muted-text tracking-wider mb-0.5 sm:mb-1 truncate">Academic Status</p>
                                <h3 className="text-xs sm:text-base font-extrabold text-primary truncate">{academicAttendanceSummary.status}</h3>
                                <p className="text-[10px] sm:text-xs font-semibold text-primary mt-0.5 truncate">Exam Eligible</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-[var(--primary-light)] text-secondary rounded-lg sm:rounded-xl shrink-0">
                                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface p-4 sm:p-6 rounded-2xl border border-border shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-primary tracking-tight">Semester Subjects & Load</h3>
                                <p className="hidden sm:block text-xs text-muted-text font-medium">Weekly subject schedule in Year {selectedYear} Sem {selectedSem} timetable.</p>
                            </div>
                            <span className="text-xs font-extrabold text-primary bg-[var(--primary-light)] px-3 py-1 rounded-lg border border-[var(--primary-light)] whitespace-nowrap shrink-0">
                                {timetableSubjects.length} Courses
                            </span>
                        </div>

                        {timetableSubjects.length === 0 ? (
                            <p className="text-muted-text text-xs font-medium text-center py-6">No subjects listed in current timetable configuration.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {timetableSubjects.map((sub, idx) => (
                                    <div key={`${sub.code || 'sub'}-${sub.name || ''}-${idx}`} className="p-4 rounded-xl border border-border bg-[var(--background)]/50 hover:bg-surface hover:border-[var(--primary-light)] transition-all space-y-2.5">
                                        <div className="flex items-start justify-between">
                                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-primary bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary-light)]">
                                                {sub.code}
                                            </span>
                                            <span className="text-xs font-bold text-muted-text">
                                                {sub.slotsCount} Weekly Hours
                                            </span>
                                        </div>
                                        <h4 className="font-extrabold text-primary text-xs sm:text-sm">{sub.name}</h4>

                                        {sub.daysStr && (
                                            <p className="text-[10px] font-semibold text-muted-text flex items-center gap-1">
                                                <Clock size={11} className="text-primary shrink-0" />
                                                <span>Slots: {sub.daysStr} {sub.slotLabelsStr ? `(${sub.slotLabelsStr})` : ''}</span>
                                            </p>
                                        )}

                                        <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] gap-2">
                                            <span className="text-sub font-bold flex items-center gap-1 min-w-0 flex-1 truncate" title={sub.faculty}>
                                                <UserCheck size={13} className="text-primary shrink-0" />
                                                <span className="truncate">{sub.faculty}</span>
                                            </span>
                                            <span className="font-extrabold text-primary bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary-light)] shrink-0">
                                                {sub.percentage}% Attd
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── PERIOD DETAILS & ATTENDANCE CALENDAR POPUP MODAL ── */}
            {selectedPeriodModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-[var(--sidebar)]/70 backdrop-blur-xs animate-fade-in"
                    onClick={() => setSelectedPeriodModal(null)}
                >
                    <div
                        className="bg-surface rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-border space-y-4 sm:space-y-5 transform transition-all scale-100 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto no-scrollbar mb-16 sm:mb-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-border">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                        {selectedPeriodModal.day} • {selectedPeriodModal.slot?.slot_name || 'Period'}
                                    </span>
                                    {selectedPeriodModal.slot?.start_time && (
                                        <span className="text-xs font-semibold text-muted-text flex items-center gap-1">
                                            <Clock size={12} className="text-primary" />
                                            {formatTimeTo12h(selectedPeriodModal.slot.start_time)} - {formatTimeTo12h(selectedPeriodModal.slot.end_time)}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-base sm:text-lg font-extrabold text-primary leading-snug">
                                    {selectedPeriodModal.entry?.subject_name || selectedPeriodModal.entry?.custom_label || selectedPeriodModal.entry?.title || 'Scheduled Period'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedPeriodModal(null)}
                                className="p-2 rounded-xl text-muted-text hover:text-sub hover:bg-background transition-colors"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        {/* Modal Body: Switch between Details Mode and Calendar Mode */}
                        {isCalendarView ? (
                            <div className="space-y-4 animate-fade-in">
                                {/* Subject & Month Header */}
                                <div className="bg-[var(--primary-light)] p-3.5 rounded-2xl border border-[var(--primary-light)] flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-extrabold uppercase text-primary tracking-wider truncate">
                                            {selectedPeriodModal.entry?.subject_code || 'Subject Attendance Log'}
                                        </p>
                                        <h4 className="text-xs sm:text-sm font-extrabold text-primary truncate">
                                            Daily Attendance Calendar
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-1 bg-surface px-2 py-1 rounded-xl border border-[var(--primary-light)] shadow-2xs shrink-0">
                                        <button
                                            onClick={() => setCalendarMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                            className="p-1 text-sub hover:text-primary hover:bg-[var(--primary-light)] rounded-lg transition-colors"
                                            title="Previous Month"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-xs font-extrabold text-primary px-1 whitespace-nowrap">
                                            {calendarMonthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                        </span>
                                        <button
                                            onClick={() => setCalendarMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                            className="p-1 text-sub hover:text-primary hover:bg-[var(--primary-light)] rounded-lg transition-colors"
                                            title="Next Month"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Attendance Status Legend */}
                                <div className="flex items-center justify-around bg-background p-2.5 rounded-xl border border-border text-[10px] sm:text-[11px] font-bold">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-md bg-[var(--success-light)] text-success border border-[var(--success-light)] flex items-center justify-center font-black text-[10px]">P</span>
                                        <span className="text-sub">Present</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-md bg-[var(--danger-light)] text-danger border border-[var(--danger-light)] flex items-center justify-center font-black text-[10px]">A</span>
                                        <span className="text-sub">Absent</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-md bg-background text-muted-text border border-border flex items-center justify-center font-black text-[10px]">N</span>
                                        <span className="text-muted-text">Null (No Record)</span>
                                    </div>
                                </div>

                                {/* Calendar Grid */}
                                <div className="border border-border rounded-2xl p-3 bg-surface space-y-2">
                                    {/* Days of Week Header */}
                                    <div className="grid grid-cols-7 gap-1 text-center border-b border-border pb-2">
                                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                                            <span key={d} className="text-[9px] font-black text-muted-text uppercase tracking-wider">{d}</span>
                                        ))}
                                    </div>

                                    {/* Calendar Date Cells */}
                                    <div className="grid grid-cols-7 gap-1 text-center">
                                        {(() => {
                                            const cYear = calendarMonthDate.getFullYear();
                                            const cMonth = calendarMonthDate.getMonth();
                                            const totalDays = new Date(cYear, cMonth + 1, 0).getDate();
                                            const startDayOfWeek = new Date(cYear, cMonth, 1).getDay();

                                            const cells = [];
                                            // Padding before 1st of month
                                            for (let p = 0; p < startDayOfWeek; p++) {
                                                cells.push(<div key={`pad-${p}`} className="h-9 sm:h-10 opacity-0" />);
                                            }

                                            // Month Days
                                            for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
                                                const dateStr = `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                                
                                                // Check periodWiseLogs for attendance status
                                                const subjCode = selectedPeriodModal.entry?.subject_code;
                                                const subjName = selectedPeriodModal.entry?.subject_name || selectedPeriodModal.entry?.custom_label;

                                                const matchedLog = periodWiseLogs.find(log => {
                                                    const lDate = log.attendance_date || log.date;
                                                    const dateMatches = lDate && String(lDate).startsWith(dateStr);
                                                    const codeMatches = subjCode && log.subject_code && log.subject_code.trim().toUpperCase() === subjCode.trim().toUpperCase();
                                                    const nameMatches = subjName && log.subject_name && log.subject_name.trim().toUpperCase() === String(subjName).trim().toUpperCase();
                                                    return dateMatches && (codeMatches || nameMatches);
                                                });

                                                let statusBadge = { code: 'N', bg: 'bg-background text-muted-text border-border' };
                                                if (matchedLog) {
                                                    if (matchedLog.status === 'present') {
                                                        statusBadge = { code: 'P', bg: 'bg-[var(--success-light)] text-success border-[var(--success-light)] font-black' };
                                                    } else if (matchedLog.status === 'absent') {
                                                        statusBadge = { code: 'A', bg: 'bg-[var(--danger-light)] text-danger border-[var(--danger-light)] font-black' };
                                                    }
                                                }

                                                cells.push(
                                                    <div
                                                        key={`day-${dayNum}`}
                                                        className="h-9 sm:h-10 rounded-xl border border-border flex flex-col items-center justify-center p-0.5 relative group hover:border-[var(--primary-light)] transition-all bg-[var(--background)]/40"
                                                    >
                                                        <span className="text-[10px] font-bold text-sub leading-none">{dayNum}</span>
                                                        <span className={`text-[8px] px-1 py-0.2 rounded mt-0.5 border leading-none ${statusBadge.bg}`}>
                                                            {statusBadge.code}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return cells;
                                        })()}
                                    </div>
                                </div>

                                {/* Back Button */}
                                <button
                                    onClick={() => setIsCalendarView(false)}
                                    className="w-full py-2.5 bg-background text-sub rounded-xl font-bold hover:bg-background transition-colors shadow-xs text-xs"
                                >
                                    ← Back to Period Details
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(() => {
                                    const subjKey = (selectedPeriodModal.entry?.subject_code || selectedPeriodModal.entry?.subject_name || selectedPeriodModal.entry?.custom_label || '').trim().toUpperCase();
                                    const stats = subjectAttendanceStatsMap.get(subjKey) || {
                                        faculty: selectedPeriodModal.entry?.faculty_name || selectedPeriodModal.entry?.teacher_name || selectedPeriodModal.entry?.faculty || selectedPeriodModal.entry?.staff_name || 'Department Faculty',
                                        percentage: '0.0',
                                        status: 'Shortage Alert',
                                        present: 0,
                                        total: 0
                                    };

                                    return (
                                        <>
                                            {/* Faculty / Teacher Card */}
                                            <div className="p-4 rounded-2xl bg-[var(--primary-light)] border border-[var(--primary-light)] flex items-center gap-3.5">
                                                <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                                                    <UserCheck size={22} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-extrabold uppercase text-primary tracking-wider">Assigned Faculty / Teacher</p>
                                                    <h4 className="text-sm font-extrabold text-primary mt-0.5">
                                                        {stats.faculty}
                                                    </h4>
                                                </div>
                                            </div>

                                            {/* Subject Attendance Info */}
                                            <div className="p-4 rounded-2xl bg-background border border-border space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-extrabold text-sub uppercase tracking-wider flex items-center gap-1.5">
                                                        <Award size={15} className="text-primary" />
                                                        Subject Attendance Status
                                                    </span>
                                                    <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${stats.status === 'Compliant' ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--danger-light)] text-danger'}`}>
                                                        {stats.status}
                                                    </span>
                                                </div>

                                                <div className="flex items-baseline justify-between pt-1">
                                                    <div>
                                                        <span className="text-2xl font-extrabold text-primary">{stats.percentage}%</span>
                                                        <span className="text-xs text-muted-text font-medium ml-2">
                                                            {stats.total > 0 ? `${stats.present} / ${stats.total} Classes Attended` : 'Semester Performance'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="w-full bg-background h-2 rounded-full overflow-hidden mt-1">
                                                    <div
                                                        className="bg-primary h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min(100, Math.max(0, Number(stats.percentage)))}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Period-wise Posted Attendance Log from ap_attendance_post_students */}
                                            {(() => {
                                                const postedLog = periodWiseLogs.find(log => {
                                                    const logDay = normalizeDay(log.day_of_week);
                                                    const dayMatch = !logDay || logDay === normalizeDay(selectedPeriodModal.day);
                                                    const slotMatch = Number(log.period_slot_id) === Number(selectedPeriodModal.slot?.id) || Number(log.timing_slot_id) === Number(selectedPeriodModal.slot?.id);
                                                    const codeMatch = selectedPeriodModal.entry?.subject_code && log.subject_code && log.subject_code.trim().toUpperCase() === selectedPeriodModal.entry.subject_code.trim().toUpperCase();
                                                    return dayMatch && (slotMatch || codeMatch);
                                                });

                                                if (!postedLog) return null;

                                                return (
                                                    <div className="p-3.5 rounded-2xl bg-[var(--warning-light)] border border-[var(--warning-light)] space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-extrabold uppercase text-warning tracking-wider flex items-center gap-1">
                                                                <UserCheck size={12} className="text-warning" />
                                                                Teacher Posted Period Record
                                                            </span>
                                                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${postedLog.status === 'present' ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--danger-light)] text-danger'}`}>
                                                                {postedLog.status.toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-extrabold text-primary">
                                                            Faculty: {postedLog.faculty_name || stats.faculty}
                                                        </p>
                                                        <p className="text-[11px] font-semibold text-sub">
                                                            Date: {postedLog.attendance_date} ({postedLog.start_time || ''} - {postedLog.end_time || ''})
                                                        </p>
                                                        {postedLog.remarks && (
                                                            <p className="text-[11px] italic text-muted-text">Remarks: {postedLog.remarks}</p>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    );
                                })()}

                                {/* Additional Period Details */}
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 rounded-xl bg-background border border-border">
                                        <p className="text-[9px] font-extrabold uppercase text-muted-text tracking-wider">Subject Code</p>
                                        <p className="font-extrabold text-primary mt-0.5">{selectedPeriodModal.entry?.subject_code || 'N/A'}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-background border border-border">
                                        <p className="text-[9px] font-extrabold uppercase text-muted-text tracking-wider">Classroom / Venue</p>
                                        <p className="font-extrabold text-primary mt-0.5">{selectedPeriodModal.entry?.room_no || selectedPeriodModal.entry?.location || 'Dept Classroom'}</p>
                                    </div>
                                </div>

                                {/* Footer Action Buttons */}
                                <div className="flex gap-2.5 pt-1">
                                    <button
                                        onClick={() => setIsCalendarView(true)}
                                        className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors shadow-xs flex items-center justify-center gap-2 text-xs"
                                    >
                                        <Calendar size={15} />
                                        View Details
                                    </button>
                                    <button
                                        onClick={() => setSelectedPeriodModal(null)}
                                        className="px-4 py-3 bg-background text-sub rounded-xl font-bold hover:bg-background transition-colors text-xs"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentTimetable;
