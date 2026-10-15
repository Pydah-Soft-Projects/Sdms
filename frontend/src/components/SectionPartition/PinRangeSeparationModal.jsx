import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  SlidersHorizontal,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Users,
  Hash,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  Save,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  comparePins,
  isPinInRange,
  distributeStudentsIntoSections,
  calculateSectionRangeStats
} from '../../utils/sectionRangeUtils';

const PinRangeSeparationModal = ({
  isOpen,
  onClose,
  filters,
  configuredSections = [],
  sectionBreakdown = [],
  students = [],
  totalStudents = 0,
  loadingAllStudents = false,
  onApplyDraft,
  onSaveDirectly,
  saving = false
}) => {
  // Normalize breakdown section items: [{ name: 'A', strength: 80 }, ...]
  const breakdownList = useMemo(() => {
    if (Array.isArray(sectionBreakdown) && sectionBreakdown.length > 0) {
      return sectionBreakdown
        .filter((item) => item && (item.name || typeof item === 'string'))
        .map((item) => (typeof item === 'object' ? item : { name: String(item), strength: null }));
    }
    if (Array.isArray(configuredSections) && configuredSections.length > 0) {
      return configuredSections
        .filter(Boolean)
        .map((item) => (typeof item === 'object' ? item : { name: String(item), strength: null }));
    }
    return [];
  }, [sectionBreakdown, configuredSections]);

  // Section names list (e.g. ['A', 'B', 'C', 'D'])
  const availableSectionNames = useMemo(() => {
    return breakdownList.map((item) => item.name).filter(Boolean);
  }, [breakdownList]);

  // Section breakdown limits the maximum number of sections dynamically!
  const hasConfiguredBreakdown = breakdownList.length > 0;
  const maxSectionsAllowed = hasConfiguredBreakdown ? breakdownList.length : 10;
  const initialSectionCount = hasConfiguredBreakdown ? breakdownList.length : 2;

  const [numberOfSections, setNumberOfSections] = useState(initialSectionCount);
  const [ranges, setRanges] = useState([]);
  const [isApplying, setIsApplying] = useState(false);
  const autoInitializedRef = useRef(false);

  // Initialize or re-initialize ranges when modal opens
  useEffect(() => {
    if (!isOpen) {
      autoInitializedRef.current = false;
      return;
    }

    const count = Math.min(initialSectionCount, maxSectionsAllowed);
    setNumberOfSections(count);

    const initialRanges = Array.from({ length: count }, (_, idx) => {
      const defaultName =
        availableSectionNames[idx] ||
        (idx < 26 ? `Section ${String.fromCharCode(65 + idx)}` : `Section ${idx + 1}`);
      return {
        id: `range-${Date.now()}-${idx}`,
        section: defaultName,
        startPin: '',
        endPin: ''
      };
    });

    setRanges(initialRanges);
  }, [isOpen, initialSectionCount, maxSectionsAllowed, availableSectionNames]);

  // Calculate real-time stats
  const stats = useMemo(() => {
    return calculateSectionRangeStats(students, ranges);
  }, [students, ranges]);

  // Handle changing the number of sections - all students must be fitted into the new section count
  const handleSectionCountChange = (newCount) => {
    const targetCount = Math.max(1, Math.min(maxSectionsAllowed, parseInt(newCount, 10) || 1));
    setNumberOfSections(targetCount);

    const sortedStudents = stats.sortedStudentsWithPin;
    const distributed =
      sortedStudents.length > 0
        ? distributeStudentsIntoSections(sortedStudents, targetCount, breakdownList)
        : [];

    setRanges((prev) => {
      const nextRanges = [];
      for (let i = 0; i < targetCount; i++) {
        const existingRange = prev[i];
        const usedNames = new Set(nextRanges.map((r) => r.section));
        const sectionName =
          existingRange?.section && !usedNames.has(existingRange.section)
            ? existingRange.section
            : availableSectionNames.find((name) => !usedNames.has(name)) ||
              availableSectionNames[i] ||
              (i < 26 ? `Section ${String.fromCharCode(65 + i)}` : `Section ${i + 1}`);

        const item = distributed[i];
        nextRanges.push({
          id: existingRange?.id || `range-${Date.now()}-${i}`,
          section: sectionName,
          startPin: item ? item.startPin || '' : existingRange?.startPin || '',
          endPin: item ? item.endPin || '' : existingRange?.endPin || ''
        });
      }
      return nextRanges;
    });
  };

  // Update a specific range property
  const handleRangeFieldChange = (id, field, value) => {
    setRanges((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          [field]: field === 'section' ? value : String(value || '').trim().toUpperCase()
        };
      })
    );
  };

  // Add a new section range row - strictly clamped by section breakdown and fits all students
  const handleAddSectionRow = () => {
    if (ranges.length >= maxSectionsAllowed) {
      toast.error(
        hasConfiguredBreakdown
          ? `Cannot exceed ${maxSectionsAllowed} sections configured in section breakdown for this branch`
          : 'Maximum 10 sections allowed'
      );
      return;
    }
    const nextCount = ranges.length + 1;
    handleSectionCountChange(nextCount);
  };

  // Remove a section range row - all students are fitted into the remaining sections
  const handleRemoveSectionRow = (id) => {
    if (ranges.length <= 1) {
      toast.error('At least one section is required');
      return;
    }
    const remainingRanges = ranges.filter((r) => r.id !== id);
    const targetCount = remainingRanges.length;
    setNumberOfSections(targetCount);

    const sortedStudents = stats.sortedStudentsWithPin;
    const distributed =
      sortedStudents.length > 0
        ? distributeStudentsIntoSections(sortedStudents, targetCount, breakdownList)
        : [];

    setRanges(
      remainingRanges.map((r, idx) => {
        const item = distributed[idx];
        return {
          ...r,
          startPin: item ? item.startPin || '' : r.startPin || '',
          endPin: item ? item.endPin || '' : r.endPin || ''
        };
      })
    );
  };

  // Auto-fill ranges if empty when students are loaded and modal is opened
  useEffect(() => {
    if (!isOpen || autoInitializedRef.current) return;
    if (ranges.length === 0 || stats.sortedStudentsWithPin.length === 0) return;

    const allEmpty = ranges.every((r) => !r.startPin && !r.endPin);
    if (!allEmpty) return;

    const distributed = distributeStudentsIntoSections(
      stats.sortedStudentsWithPin,
      ranges.length,
      breakdownList
    );

    if (distributed.length > 0) {
      setRanges((prev) =>
        prev.map((range, idx) => {
          const item = distributed[idx];
          if (!item) return range;
          return {
            ...range,
            startPin: item.startPin || '',
            endPin: item.endPin || ''
          };
        })
      );
      autoInitializedRef.current = true;
    }
  }, [isOpen, ranges, stats.sortedStudentsWithPin, breakdownList]);

  // Helper to find 1-based serial number for a PIN
  const getSerialForPin = (pin, isEnd = false) => {
    if (!pin) return null;
    const list = stats.sortedStudentsWithPin;
    if (isEnd) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i]?.pinNo === pin) return i + 1;
      }
      return null;
    }
    const idx = list.findIndex((s) => s?.pinNo === pin);
    return idx !== -1 ? idx + 1 : null;
  };

  // Helper to compute target serial range from section breakdown
  const getBreakdownTargetRange = (index) => {
    if (!breakdownList || !breakdownList[index]) return null;
    const strength = Number(breakdownList[index].strength);
    if (!strength) return null;
    const start =
      breakdownList
        .slice(0, index)
        .reduce((sum, item) => sum + (Number(item?.strength) || 0), 0) + 1;
    const end = start + strength - 1;
    return { start, end, strength, label: `${start}-${end}` };
  };

  // Auto-distribute across sections (uses breakdown capacities if configured)
  const handleAutoDistribute = () => {
    if (stats.sortedStudentsWithPin.length === 0) {
      toast.error('No students with PIN numbers found in this batch');
      return;
    }

    const distributed = distributeStudentsIntoSections(
      stats.sortedStudentsWithPin,
      ranges.length,
      breakdownList
    );

    setRanges((prev) =>
      prev.map((range, idx) => {
        const item = distributed[idx];
        if (!item) return range;
        return {
          ...range,
          startPin: item.startPin,
          endPin: item.endPin
        };
      })
    );

    const hasBreaks = breakdownList.some((b) => Number(b.strength) > 0);
    toast.success(
      hasBreaks
        ? `Distributed ${stats.sortedStudentsWithPin.length} students across ${ranges.length} sections based on section breakdown`
        : `Distributed ${stats.sortedStudentsWithPin.length} students across ${ranges.length} sections`
    );
  };

  // Clear all PIN ranges
  const handleClearRanges = () => {
    setRanges((prev) =>
      prev.map((r) => ({
        ...r,
        startPin: '',
        endPin: ''
      }))
    );
  };

  // Collect assignment pairs { admissionNumber, section }
  const getAssignments = () => {
    const validRanges = ranges.filter((r) => r.section && r.startPin && r.endPin);
    if (validRanges.length === 0) {
      return null;
    }

    const assignments = [];
    students.forEach((student) => {
      const pin = student.pinNo;
      if (!pin) return;

      for (const range of validRanges) {
        if (isPinInRange(pin, range.startPin, range.endPin)) {
          assignments.push({
            admissionNumber: student.admissionNumber,
            section: range.section
          });
          break; // First matching range wins
        }
      }
    });

    return assignments;
  };

  // Apply to table draft state (allows user to review highlighted rows before saving)
  const handleApplyToDraft = () => {
    const assignments = getAssignments();
    if (!assignments || assignments.length === 0) {
      toast.error('Please specify valid Start and End PINs for at least one section');
      return;
    }

    onApplyDraft(assignments);
    toast.success(`Applied ${assignments.length} section draft assignments. Click Save to persist.`);
    onClose();
  };

  // Save directly to the backend database
  const handleSaveDirect = async () => {
    const assignments = getAssignments();
    if (!assignments || assignments.length === 0) {
      toast.error('Please specify valid Start and End PINs for at least one section');
      return;
    }

    setIsApplying(true);
    try {
      await onSaveDirectly(assignments, ranges);
      onClose();
    } catch (err) {
      console.error('Failed to save PIN range partition:', err);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-separation-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/70 via-white to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h2 id="pin-separation-title" className="text-lg font-bold text-gray-900 leading-tight">
                Section Separation by PIN Range
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-gray-600">
                <span className="font-semibold text-indigo-700">{filters.course || 'Course'}</span>
                <span>•</span>
                <span>{filters.branch || 'Branch'}</span>
                <span>•</span>
                <span className="bg-indigo-100/70 text-indigo-800 font-medium px-1.5 py-0.5 rounded">
                  Batch {filters.batch || 'Batch'}
                </span>
                {filters.college && (
                  <>
                    <span>•</span>
                    <span className="text-gray-500 truncate max-w-[200px]" title={filters.college}>
                      {filters.college}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loadingAllStudents ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-500">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Loading all batch students for PIN range calculation...</p>
            </div>
          ) : (
            <>
              {/* Batch PIN Stats Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <Users size={14} className="text-indigo-600" />
                    Total Students
                  </div>
                  <div className="mt-2 text-2xl font-black text-gray-900">
                    {stats.totalStudents.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {stats.withPinCount} with PIN{stats.withPinCount === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <Hash size={14} className="text-indigo-600" />
                    PIN Range
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-gray-800 truncate" title={`${stats.minPin || 'N/A'} - ${stats.maxPin || 'N/A'}`}>
                    {stats.minPin ? `${stats.minPin} → ${stats.maxPin}` : 'No PINs found'}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Lowest to Highest in batch
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Total Matched
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-700">
                    {stats.totalMatched}
                    <span className="text-xs font-medium text-gray-500 ml-1">
                      / {stats.withPinCount}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {stats.withPinCount > 0
                      ? `${Math.round((stats.totalMatched / stats.withPinCount) * 100)}% covered`
                      : '0%'}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <AlertCircle size={14} className={stats.unmatchedCount > 0 ? 'text-amber-500' : 'text-gray-400'} />
                    Unmatched / No PIN
                  </div>
                  <div className={`mt-2 text-2xl font-black ${stats.unmatchedCount > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                    {stats.unmatchedCount}
                    {stats.noPinCount > 0 && (
                      <span className="text-xs font-semibold text-rose-500 ml-1.5" title={`${stats.noPinCount} student(s) have no PIN`}>
                        ({stats.noPinCount} no PIN)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {stats.unmatchedCount === 0 && stats.noPinCount === 0 ? 'All students assigned' : 'Will remain unchanged'}
                  </div>
                </div>
              </div>

              {/* Number of Sections Selector and Auto-Distribute Toolbar */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label htmlFor="num-sections-input" className="block text-xs font-bold uppercase tracking-wider text-indigo-900">
                        Number of Sections to Separate
                      </label>
                      {hasConfiguredBreakdown && (
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                          Breakdown Limit: Max {maxSectionsAllowed}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center border border-indigo-200 rounded-lg bg-white shadow-sm overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleSectionCountChange(numberOfSections - 1)}
                          disabled={numberOfSections <= 1}
                          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Decrease section count"
                        >
                          -
                        </button>
                        <input
                          id="num-sections-input"
                          type="number"
                          min="1"
                          max={maxSectionsAllowed}
                          value={numberOfSections}
                          onChange={(e) => handleSectionCountChange(e.target.value)}
                          className="w-14 text-center py-1.5 text-sm font-bold text-gray-900 border-x border-indigo-100 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSectionCountChange(numberOfSections + 1)}
                          disabled={numberOfSections >= maxSectionsAllowed}
                          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Increase section count"
                          title={
                            numberOfSections >= maxSectionsAllowed
                              ? `Cannot exceed ${maxSectionsAllowed} sections configured in section breakdown`
                              : 'Increase section count'
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick actions: Auto-distribute & Clear */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={handleAutoDistribute}
                    disabled={stats.withPinCount === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      hasConfiguredBreakdown
                        ? 'Distribute students across sections according to configured section breakdown strengths'
                        : 'Evenly divides regular students across sections by sorted PIN'
                    }
                  >
                    <Sparkles size={14} />
                    Auto-Distribute Ranges
                  </button>
                  <button
                    type="button"
                    onClick={handleClearRanges}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors"
                    title="Clear Start and End PIN inputs"
                  >
                    <RotateCcw size={14} />
                    Clear
                  </button>
                </div>
              </div>

              {/* Overlap / Warning Banner */}
              {stats.overlappingCount > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Overlapping Ranges Detected:</span>{' '}
                    {stats.overlappingCount} student(s) fall into multiple section ranges. The first matching section in the list will be assigned.
                  </div>
                </div>
              )}

              {/* Section PIN Range Rows List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                  <span>Sections & PIN Number Ranges</span>
                  <span>Estimated Counts</span>
                </div>

                {ranges.map((range, index) => {
                  const stat = stats.sectionCounts.find((s) => s.id === range.id) || {
                    count: 0,
                    percentage: 0,
                    isInvalidRange: false
                  };

                  // Check if this section has overlapping students with others
                  const hasOverlap = stats.overlaps.some((o) =>
                    o.sections.includes(range.section)
                  );

                  const startSerial = getSerialForPin(range.startPin, false);
                  const endSerial = getSerialForPin(range.endPin, true);
                  const targetConfig = getBreakdownTargetRange(index);

                  return (
                    <div
                      key={range.id}
                      className={`p-4 rounded-xl border transition-all ${
                        stat.isInvalidRange
                          ? 'border-rose-300 bg-rose-50/40'
                          : hasOverlap
                          ? 'border-amber-300 bg-amber-50/30'
                          : stat.count > 0
                          ? 'border-indigo-200 bg-indigo-50/20 shadow-sm'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Section Selector / Name */}
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                Section Name
                              </label>
                              {targetConfig && (
                                <span
                                  className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded"
                                  title={`Target range from breakdown: S.No ${targetConfig.label} (${targetConfig.strength} capacity)`}
                                >
                                  Cap: {targetConfig.strength}
                                </span>
                              )}
                            </div>
                            {availableSectionNames.length > 0 ? (
                              <select
                                value={range.section}
                                onChange={(e) =>
                                  handleRangeFieldChange(range.id, 'section', e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                {breakdownList.map((item) => (
                                  <option key={item.name} value={item.name}>
                                    Section {item.name}{item.strength ? ` (${item.strength} students)` : ''}
                                  </option>
                                ))}
                                {!availableSectionNames.includes(range.section) && (
                                  <option value={range.section}>{range.section}</option>
                                )}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={range.section}
                                onChange={(e) =>
                                  handleRangeFieldChange(range.id, 'section', e.target.value)
                                }
                                placeholder="Section Name (e.g. A)"
                                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            )}
                          </div>
                        </div>

                        {/* PIN Range Dropdowns: Start to End */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:items-center">
                          {/* From (Start PIN) Dropdown */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                From (Start PIN)
                              </label>
                              {startSerial !== null && (
                                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                  S.No #{startSerial}
                                </span>
                              )}
                            </div>
                            <select
                              value={range.startPin}
                              onChange={(e) =>
                                handleRangeFieldChange(range.id, 'startPin', e.target.value)
                              }
                              className="w-full font-mono border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            >
                              <option value="">-- Select Start PIN --</option>
                              {stats.sortedStudentsWithPin.map((student, sIdx) => {
                                const sNo = sIdx + 1;
                                return (
                                  <option
                                    key={`start-${range.id}-${student.pinNo}-${sIdx}`}
                                    value={student.pinNo}
                                  >
                                    {sNo}. {student.pinNo}{student.studentName ? ` - ${student.studentName}` : ''}
                                  </option>
                                );
                              })}
                              {range.startPin &&
                                !stats.sortedStudentsWithPin.some((s) => s.pinNo === range.startPin) && (
                                  <option value={range.startPin}>{range.startPin}</option>
                                )}
                            </select>
                          </div>

                          {/* To (End PIN) Dropdown */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                To (End PIN)
                              </label>
                              {endSerial !== null && (
                                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                  S.No #{endSerial}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={range.endPin}
                                onChange={(e) =>
                                  handleRangeFieldChange(range.id, 'endPin', e.target.value)
                                }
                                className="w-full font-mono border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                              >
                                <option value="">-- Select End PIN --</option>
                                {stats.sortedStudentsWithPin.map((student, sIdx) => {
                                  const sNo = sIdx + 1;
                                  return (
                                    <option
                                      key={`end-${range.id}-${student.pinNo}-${sIdx}`}
                                      value={student.pinNo}
                                    >
                                      {sNo}. {student.pinNo}{student.studentName ? ` - ${student.studentName}` : ''}
                                    </option>
                                  );
                                })}
                                {range.endPin &&
                                  !stats.sortedStudentsWithPin.some((s) => s.pinNo === range.endPin) && (
                                    <option value={range.endPin}>{range.endPin}</option>
                                  )}
                              </select>
                              {ranges.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSectionRow(range.id)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                                  title="Remove Section"
                                  aria-label="Remove Section"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Estimated Count Badge */}
                        <div className="lg:w-48 flex lg:flex-col lg:items-end justify-between items-center shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0">
                          <div className="text-xs text-gray-500 font-medium lg:hidden">
                            Estimated:
                          </div>
                          {stat.isInvalidRange ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                              <AlertCircle size={12} />
                              Start &gt; End PIN
                            </span>
                          ) : stat.count > 0 ? (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                <Check size={12} />
                                {stat.count} Student{stat.count === 1 ? '' : 's'}
                              </span>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {stat.percentage}% of total batch
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                              0 Students
                            </span>
                          )}

                          {/* Serial Number Range comparison */}
                          {startSerial && endSerial && !stat.isInvalidRange && (
                            <div className="text-[11px] text-gray-500 text-right mt-1 font-mono">
                              S.No {startSerial} → {endSerial}
                            </div>
                          )}

                          {hasOverlap && !stat.isInvalidRange && (
                            <span className="text-[10px] text-amber-600 font-semibold mt-1">
                              ⚠️ Overlaps with other range
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Section Button - Clamped to Breakdown */}
              {ranges.length < maxSectionsAllowed ? (
                <button
                  type="button"
                  onClick={handleAddSectionRow}
                  className="w-full py-2.5 px-4 rounded-xl border border-dashed border-gray-300 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus size={16} />
                  Add Another Section
                </button>
              ) : hasConfiguredBreakdown ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs text-gray-500 font-medium">
                  Maximum limit reached: {maxSectionsAllowed} of {maxSectionsAllowed} sections configured in section breakdown for {filters.branch || 'this branch'}
                </div>
              ) : null}

              {/* Missing PIN notes */}
              {stats.noPinCount > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <span className="font-semibold text-gray-700">Note:</span> {stats.noPinCount} student(s) in this batch do not have a PIN number assigned. They cannot be partitioned by PIN range and will retain their existing sections.
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/80 rounded-b-2xl shrink-0">
          <div className="text-xs text-gray-600">
            <span className="font-bold text-gray-900">{stats.totalMatched}</span> of{' '}
            <span className="font-bold text-gray-900">{stats.withPinCount}</span> students with PINs matched
            {stats.unmatchedCount > 0 && (
              <span className="text-amber-600 ml-1">({stats.unmatchedCount} unassigned)</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying || saving}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplyToDraft}
              disabled={isApplying || saving || stats.totalMatched === 0}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Apply section changes to table rows so you can review before saving"
            >
              Apply to Table (Review)
            </button>

            <button
              type="button"
              onClick={handleSaveDirect}
              disabled={isApplying || saving || stats.totalMatched === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save section assignments directly to database"
            >
              {isApplying || saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Directly ({stats.totalMatched})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinRangeSeparationModal;
