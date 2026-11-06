import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, CheckCircle } from 'lucide-react';
import TargetSelector from '../TargetSelector';
import { emptyHolidayTargets, formatHolidayScope } from '../../utils/holidayTargeting';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_META = {
  submitted: {
    label: 'Submitted',
    badgeClass: 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
  },
  not_marked: {
    label: 'Not marked',
    badgeClass: 'bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]'
  },
  pending: {
    label: 'Pending',
    badgeClass: 'bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]'
  },
  upcoming: {
    label: 'Upcoming',
    badgeClass: 'bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]'
  }
};

const normalizeDateToIST = (dateStr) => {
  if (!dateStr) return '';
  // If it's already YYYY-MM-DD, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // If it's an ISO string, convert to IST date (YYYY-MM-DD)
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch (e) {
    return dateStr;
  }
};

const formatIsoDate = (isoDate, formatOptions = {}) => {
  if (!isoDate) return '';

  // First normalize to YYYY-MM-DD in IST to ensure we mean the correct day
  const normalizedDate = normalizeDateToIST(isoDate);

  // Then create a local date at midnight for formatting
  const date = new Date(`${normalizedDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, formatOptions);
};

const parseMonthKey = (monthKey) => {
  if (!monthKey) return null;
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  return { year, month };
};

const buildCalendarMatrix = (monthKey) => {
  const parts = parseMonthKey(monthKey);
  if (!parts) return [];

  const { year, month } = parts;
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = firstDay.getUTCDay(); // 0 (Sun) - 6 (Sat)

  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const cells = [];

  for (let index = 0; index < totalCells; index += 1) {
    const dayOffset = index - startWeekday + 1;
    const cellDate = new Date(Date.UTC(year, month - 1, dayOffset));
    const isCurrentMonth = dayOffset >= 1 && dayOffset <= daysInMonth;
    const isoDate = `${cellDate.getUTCFullYear()}-${String(cellDate.getUTCMonth() + 1).padStart(2, '0')}-${String(
      cellDate.getUTCDate()
    ).padStart(2, '0')}`;
    cells.push({
      index,
      isCurrentMonth,
      isoDate,
      day: cellDate.getUTCDate(),
      weekday: cellDate.getUTCDay()
    });
  }

  return cells;
};

const formatFriendlyDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const HolidayCalendarModal = ({
  isOpen,
  onClose,
  monthKey,
  onMonthChange,
  selectedDate,
  onSelectDate,
  calendarData,
  loading = false,
  error = null,
  onRetry,
  onCreateHoliday,
  onRemoveHoliday,
  mutationLoading = false,
  isAdmin = false,
  upcomingHolidays = [],
  nonWorkingDayDetails = null,
  selectedDateStatus = null,
  statusSummaryMeta = {},
  presentCount = 0,
  absentCount = 0,
  unmarkedCount = 0,
  lastUpdatedAt = null,
  editingLockReason = null,
  calendarError = null,
  onRetryCalendarFetch = null
}) => {
  const [localTitle, setLocalTitle] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [holidayTargetForm, setHolidayTargetForm] = useState(emptyHolidayTargets());

  const data = calendarData || {
    sundays: [],
    publicHolidays: [],
    customHolidays: [],
    attendanceStatus: {},
    attendanceCounts: {}
  };

  const calendarCells = useMemo(() => buildCalendarMatrix(monthKey), [monthKey]);

  const publicHolidayMap = useMemo(() => {
    const map = new Map();
    (data.publicHolidays || []).forEach((holiday) => {
      // Normalize date to YYYY-MM-DD format for consistent matching
      const normalizedDate = normalizeDateToIST(holiday.date);
      if (normalizedDate) {
        map.set(normalizedDate, holiday);
      }
    });
    return map;
  }, [data.publicHolidays]);

  const customHolidaysByDate = useMemo(() => {
    const map = new Map();
    (data.customHolidays || []).forEach((holiday) => {
      const normalizedDate = normalizeDateToIST(holiday.date);
      if (!normalizedDate) return;
      const existing = map.get(normalizedDate) || [];
      existing.push(holiday);
      map.set(normalizedDate, existing);
    });
    return map;
  }, [data.customHolidays]);

  const attendanceStatusMap = useMemo(() => {
    const entries = data.attendanceStatus && typeof data.attendanceStatus === 'object'
      ? data.attendanceStatus
      : {};
    return new Map(Object.entries(entries));
  }, [data.attendanceStatus]);

  const sundaySet = useMemo(() => new Set(data.sundays || []), [data.sundays]);

  const selectedHolidayDetails = useMemo(() => {
    if (!selectedDate) return null;
    // Normalize selected date to YYYY-MM-DD format for consistent matching
    const normalizedSelectedDate = selectedDate.split('T')[0];
    const publicHoliday = publicHolidayMap.get(normalizedSelectedDate);
    const customHolidays = customHolidaysByDate.get(normalizedSelectedDate) || [];
    const isSunday = sundaySet.has(normalizedSelectedDate);
    const status = attendanceStatusMap.get(normalizedSelectedDate) || null;

    return {
      publicHoliday,
      customHolidays,
      customHoliday: customHolidays[0] || null,
      isSunday,
      status
    };
  }, [selectedDate, publicHolidayMap, customHolidaysByDate, sundaySet, attendanceStatusMap]);

  const monthLabel = useMemo(() => {
    const parts = parseMonthKey(monthKey);
    if (!parts) return '';
    return `${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
  }, [monthKey]);

  const handlePrevMonth = () => {
    if (!monthKey || !onMonthChange) return;
    const parts = parseMonthKey(monthKey);
    if (!parts) return;
    const prev = new Date(Date.UTC(parts.year, parts.month - 2, 1));
    onMonthChange(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    if (!monthKey || !onMonthChange) return;
    const parts = parseMonthKey(monthKey);
    if (!parts) return;
    const next = new Date(Date.UTC(parts.year, parts.month, 1));
    onMonthChange(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const handleDayClick = (cell) => {
    if (!cell.isCurrentMonth) return;
    if (!onSelectDate) return;
    onSelectDate(cell.isoDate);

    setLocalTitle('');
    setLocalDescription('');
    setHolidayTargetForm(emptyHolidayTargets());
  };

  useEffect(() => {
    if (!selectedDate) {
      setLocalTitle('');
      setLocalDescription('');
      return;
    }

    setLocalTitle('');
    setLocalDescription('');
    setHolidayTargetForm(emptyHolidayTargets());
  }, [selectedDate]);

  const handleCreateHoliday = () => {
    if (!selectedDate || !onCreateHoliday) return;
    onCreateHoliday({
      date: selectedDate,
      title: localTitle || 'Holiday',
      description: localDescription,
      ...holidayTargetForm
    });
    setLocalTitle('');
    setLocalDescription('');
    setHolidayTargetForm(emptyHolidayTargets());
  };

  const handleRemoveHoliday = (holidayId) => {
    if (!holidayId || !onRemoveHoliday) return;
    onRemoveHoliday(holidayId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 py-6 overflow-y-auto">
      <div className="relative w-full max-w-7xl rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[var(--primary-light)] p-3 text-primary">
              <CalendarDays size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-main">Attendance Calendar</h2>
              <p className="text-sm text-muted-text">
                Review public holidays, institute breaks, and mark custom holidays.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-text transition-colors hover:bg-background hover:text-sub"
            aria-label="Close calendar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-6 py-4">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded-lg border border-border p-2 text-sub transition-colors hover:bg-background"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className="text-lg font-semibold text-main">{monthLabel}</div>
                <div className="text-xs text-muted-text">
                  {loading ? 'Loading calendar…' : 'Tap a date to view details'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded-lg border border-border p-2 text-sub transition-colors hover:bg-background"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 px-4 pb-3 text-center text-xs font-semibold uppercase text-muted-text">
              {WEEKDAY_NAMES.map((name) => (
                <div key={name} className="py-2">
                  {name}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 px-4 pb-6">
              {calendarCells.map((cell) => {
                const status = attendanceStatusMap.get(cell.isoDate) || null;
                const isSelected = selectedDate === cell.isoDate;
                const isSunday = sundaySet.has(cell.isoDate);
                const publicHoliday = publicHolidayMap.get(cell.isoDate);
                const customHolidaysForCell = customHolidaysByDate.get(cell.isoDate) || [];
                const customHoliday = customHolidaysForCell[0] || null;
                const isHoliday = Boolean(publicHoliday || customHolidaysForCell.length > 0 || isSunday);
                const statusInfo = status && STATUS_META[status];

                // Determine cell background color based on day type
                // Use distinct colors to differentiate holidays from "Not marked" status (which uses red)
                let cellBgColor = 'bg-surface';
                if (isHoliday) {
                  if (publicHoliday) {
                    cellBgColor = 'bg-[var(--warning-light)]'; // Changed from red to orange to differentiate from "Not marked"
                  } else if (customHoliday) {
                    cellBgColor = 'bg-[var(--primary-light)]';
                  } else if (isSunday) {
                    cellBgColor = 'bg-[var(--warning-light)]';
                  }
                } else {
                  cellBgColor = 'bg-[var(--primary-light)]';
                }

                const badgeColor = isHoliday
                  ? publicHoliday
                    ? 'bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]' // Changed from red to orange
                    : customHoliday
                      ? 'bg-[var(--primary-light)] text-secondary border border-[var(--primary-light)]'
                      : 'bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]'
                  : 'bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]';

                const baseClasses = cell.isCurrentMonth
                  ? 'cursor-pointer hover:border-primary hover:text-primary'
                  : 'cursor-not-allowed text-muted-text';

                return (
                  <button
                    key={cell.index}
                    type="button"
                    onClick={() => handleDayClick(cell)}
                    disabled={!cell.isCurrentMonth}
                    className={`flex h-28 flex-col justify-between rounded-lg border py-2 px-1 text-sm transition-colors ${isSelected
                      ? 'border-primary bg-[var(--primary-light)] text-primary shadow-md ring-2 ring-[var(--primary-light)]'
                      : `${cellBgColor} text-sub ${baseClasses}`
                      }`}
                  >
                    <span className="font-semibold text-base">{cell.day}</span>

                    {/* Show present/absent counts for non-holiday dates */}
                    {!isHoliday && data.attendanceCounts && data.attendanceCounts[cell.isoDate] && (
                      <div className="flex flex-col gap-0.5 text-[10px] font-semibold leading-tight">
                        <span className="text-success">P: {data.attendanceCounts[cell.isoDate].present}</span>
                        <span className="text-danger">A: {data.attendanceCounts[cell.isoDate].absent}</span>
                      </div>
                    )}

                    {isHoliday && (
                      <span className={`mx-2 rounded-md px-2 py-1 text-[10px] font-semibold ${badgeColor}`}>
                        {publicHoliday
                          ? 'Public Holiday'
                          : customHoliday
                            ? 'Institute Holiday'
                            : 'Sunday'}
                      </span>
                    )}
                    {!isHoliday && !data.attendanceCounts?.[cell.isoDate] && <span className="h-2" />}
                    {/* Only show attendance status if it's not a holiday */}
                    {!isHoliday && statusInfo && (
                      <span
                        className={`mx-2 rounded-md px-2 py-1 text-[10px] font-semibold ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mx-6 mb-4 flex items-start gap-2 rounded-lg border border-[var(--danger-light)] bg-[var(--danger-light)] p-3 text-sm text-danger">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold uppercase tracking-wide text-danger">
                    Calendar data unavailable
                  </div>
                  <div>{error}</div>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4 hover:text-danger"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="w-full max-w-full px-6 py-5 lg:w-[420px] space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            {/* Selected Date Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-main">Selected Date</h3>
                {selectedDate && (
                  <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-sub">
                    {formatIsoDate(selectedDate, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                )}
              </div>

              {/* Non-working Day Warning */}
              {nonWorkingDayDetails?.isNonWorkingDay && (
                <div className="flex items-start gap-2 rounded-md border border-[var(--warning-light)] bg-[var(--warning-light)] p-3 text-xs text-warning">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <div className="font-semibold uppercase tracking-wide text-warning">
                      Non-working day
                    </div>
                    <div>{nonWorkingDayDetails.reasons?.join('. ') || 'Holiday'}</div>
                  </div>
                </div>
              )}

              {/* Calendar Error */}
              {calendarError && (
                <div className="flex items-start gap-2 rounded-md border border-[var(--danger-light)] bg-[var(--danger-light)] p-3 text-xs text-danger">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <div className="font-semibold uppercase tracking-wide text-danger">
                      Calendar sync unavailable
                    </div>
                    <div>{calendarError}</div>
                    {onRetryCalendarFetch && (
                      <button
                        type="button"
                        onClick={onRetryCalendarFetch}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:text-danger underline decoration-dotted"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming Holidays */}
              {!calendarError && upcomingHolidays.length > 0 && (
                <div className="rounded-md border border-[var(--primary-light)] bg-[var(--primary-light)] p-3 text-xs text-primary">
                  <div className="font-semibold uppercase tracking-wide text-primary mb-2">Upcoming holidays</div>
                  <div className="space-y-2">
                    {upcomingHolidays.map((holiday) => (
                      <div key={`${holiday.type}-${holiday.date}`} className="flex items-center justify-between gap-2">
                        <span className="font-medium">{formatFriendlyDate(holiday.date)}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs">{holiday.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${holiday.type === 'public'
                              ? 'bg-[var(--danger-light)] text-danger'
                              : 'bg-[var(--primary-light)] text-secondary'
                              }`}
                          >
                            {holiday.type === 'public' ? 'Public' : 'Institute'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editing Lock Reason */}
              {!nonWorkingDayDetails?.isNonWorkingDay && editingLockReason && (
                <div className="rounded-md border border-[var(--primary-light)] bg-[var(--primary-light)] p-3 text-xs text-primary">
                  {editingLockReason}
                </div>
              )}

              {/* Status Summary */}
              {selectedDateStatus &&
                selectedDateStatus !== 'holiday' &&
                statusSummaryMeta[selectedDateStatus] && (
                  <div
                    className={`rounded-md border px-3 py-2 text-xs font-semibold ${statusSummaryMeta[selectedDateStatus].className || 'bg-background text-sub border-border'
                      }`}
                  >
                    {statusSummaryMeta[selectedDateStatus].message || selectedDateStatus}
                  </div>
                )}

              {/* Attendance Summary */}
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-sub mb-2">
                  Attendance Summary
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sub">Present:</span>
                    <span className="font-semibold text-success">{presentCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sub">Absent:</span>
                    <span className="font-semibold text-danger">{absentCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sub">Pending:</span>
                    <span className="font-semibold text-sub">{unmarkedCount}</span>
                  </div>
                </div>
                {lastUpdatedAt && (
                  <div className="mt-2 text-xs text-muted-text border-t border-border pt-2">
                    Last updated: {new Date(lastUpdatedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {!selectedDate && (
              <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm text-sub">
                Choose a date on the calendar to view holiday details or mark an institute break.
              </div>
            )}

            {selectedDate && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-[var(--primary-light)] bg-[var(--primary-light)] p-4 text-sm text-primary">
                  <div className="font-semibold text-primary">
                    {selectedHolidayDetails?.publicHoliday
                      ? selectedHolidayDetails.publicHoliday.localName ||
                      selectedHolidayDetails.publicHoliday.name
                      : selectedHolidayDetails?.customHoliday
                        ? selectedHolidayDetails.customHoliday.title || 'Institute Holiday'
                        : selectedHolidayDetails?.isSunday
                          ? 'Sunday'
                          : 'Instructional Day'}
                  </div>
                  <div className="mt-1 text-xs text-primary">
                    {selectedHolidayDetails?.publicHoliday
                      ? selectedHolidayDetails.publicHoliday.name
                      : selectedHolidayDetails?.customHoliday?.description
                        ? selectedHolidayDetails.customHoliday.description
                        : selectedHolidayDetails?.isSunday
                          ? 'Weekly holiday'
                          : 'Classes are expected to be held on this date.'}
                  </div>
                </div>
                {/* Only show attendance status if it's not a holiday */}
                {selectedHolidayDetails?.status &&
                  selectedHolidayDetails.status !== 'holiday' &&
                  !selectedHolidayDetails?.customHoliday &&
                  !selectedHolidayDetails?.publicHoliday &&
                  !selectedHolidayDetails?.isSunday && (
                    <div
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${STATUS_META[selectedHolidayDetails.status]?.badgeClass ||
                        'bg-background text-sub border-border'
                        }`}
                    >
                      {STATUS_META[selectedHolidayDetails.status]?.label ||
                        selectedHolidayDetails.status}
                    </div>
                  )}

                {isAdmin && (
                  <div className="space-y-3">
                    {(selectedHolidayDetails?.customHolidays || []).length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-text">
                          Holidays on this date
                        </div>
                        {(selectedHolidayDetails.customHolidays || []).map((holiday) => (
                          <div
                            key={holiday.id || `${holiday.date}-${holiday.title}`}
                            className="rounded-lg border border-[var(--primary-light)] bg-[var(--primary-light)] p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-secondary">{holiday.title || 'Institute Holiday'}</div>
                                {holiday.description && (
                                  <div className="mt-1 text-xs text-secondary">{holiday.description}</div>
                                )}
                                <div className="mt-1 text-[11px] text-secondary">{formatHolidayScope(holiday)}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveHoliday(holiday.id)}
                                disabled={mutationLoading || !holiday.id}
                                className="rounded-md border border-[var(--danger-light)] bg-surface px-2 py-1 text-[11px] font-semibold text-danger hover:bg-[var(--danger-light)] disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-muted-text">
                        Holiday title
                      </label>
                      <input
                        type="text"
                        value={localTitle}
                        onChange={(event) => setLocalTitle(event.target.value)}
                        placeholder="e.g. Founders' Day"
                        className="mt-1 w-full rounded-md border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        disabled={mutationLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-muted-text">
                        Notes (visible to staff)
                      </label>
                      <textarea
                        value={localDescription}
                        onChange={(event) => setLocalDescription(event.target.value)}
                        placeholder="Optional: add a note for this holiday"
                        rows={3}
                        className="mt-1 w-full rounded-md border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        disabled={mutationLoading}
                      />
                    </div>

                    <TargetSelector formData={holidayTargetForm} setFormData={setHolidayTargetForm} />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCreateHoliday}
                        disabled={mutationLoading}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary"
                      >
                        {mutationLoading ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface border-t-transparent" />
                            Saving…
                          </>
                        ) : (
                          'Save Institute Holiday'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-3 border-t border-border pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-text">
                Calendar Legend
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-sub">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 rounded border-2 border-[var(--warning-light)] bg-[var(--warning-light)]" />
                  <span className="font-medium">Public Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 rounded border-2 border-[var(--primary-light)] bg-[var(--primary-light)]" />
                  <span className="font-medium">Institute Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 rounded border-2 border-[var(--warning-light)] bg-[var(--warning-light)]" />
                  <span className="font-medium">Sunday</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 rounded border-2 border-[var(--primary-light)] bg-[var(--primary-light)]" />
                  <span className="font-medium">Working Day</span>
                </div>
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-text mb-1">
                    Attendance Status
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 rounded-full border border-[var(--success-light)] bg-[var(--success-light)]" />
                    <span>Submitted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 rounded-full border border-[var(--danger-light)] bg-[var(--danger-light)]" />
                    <span>Not marked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 rounded-full border border-[var(--warning-light)] bg-[var(--warning-light)]" />
                    <span>Pending</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-text">
                  This month&apos;s holidays
                </div>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-2 text-sm text-sub">
                  {data.publicHolidays?.length === 0 &&
                    data.customHolidays?.length === 0 &&
                    data.sundays?.length === 0 ? (
                    <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-text">
                      No holidays recorded for this month yet.
                    </div>
                  ) : (
                    <>
                      {(data.publicHolidays || []).map((holiday) => (
                        <div
                          key={`public-${holiday.date}`}
                          className="flex items-start gap-2 rounded-lg border border-[var(--warning-light)] bg-[var(--warning-light)] p-2 text-warning"
                        >
                          <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-warning" />
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-warning">
                              {formatIsoDate(holiday.date, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm font-semibold">
                              {holiday.localName || holiday.name}
                            </div>
                            {holiday.name && holiday.localName && holiday.localName !== holiday.name && (
                              <div className="text-xs text-warning">{holiday.name}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(data.customHolidays || []).map((holiday) => (
                        <div
                          key={`custom-${holiday.id || holiday.date}-${holiday.title}`}
                          className="flex items-start gap-2 rounded-lg border border-[var(--primary-light)] bg-[var(--primary-light)] p-2 text-secondary"
                        >
                          <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-secondary" />
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-secondary">
                              {formatIsoDate(holiday.date, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm font-semibold">{holiday.title || 'Institute Holiday'}</div>
                            {holiday.description && (
                              <div className="text-xs text-secondary">{holiday.description}</div>
                            )}
                            <div className="text-[11px] text-secondary">{formatHolidayScope(holiday)}</div>
                          </div>
                        </div>
                      ))}
                      {(data.sundays || []).map((iso) => (
                        <div
                          key={`sunday-${iso}`}
                          className="flex items-start gap-2 rounded-lg border border-[var(--warning-light)] bg-[var(--warning-light)] p-2 text-warning"
                        >
                          <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-warning" />
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-warning">
                              {formatIsoDate(iso, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm font-semibold">Sunday</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default HolidayCalendarModal;

