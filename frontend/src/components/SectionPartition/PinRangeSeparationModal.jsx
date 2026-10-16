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
  Check,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  comparePins,
  isPinInRange,
  distributeStudentsIntoSections,
  calculateSectionRangeStats,
  getAvailableRangeOptions
} from '../../utils/sectionRangeUtils';

const PinRangeSeparationModal = ({
  isOpen,
  onClose,
  filters,
  configuredSections = [],
  sectionBreakdown = [],
  students = [],
  totalStudents = 0,
  statusCounts = { all: 0, marked: 0, notMarked: 0 },
  loadingAllStudents = false,
  onApplyDraft,
  onSaveDirectly,
  saving = false
}) => {
  const markedCount = useMemo(() => {
    if (statusCounts?.marked !== undefined && statusCounts.marked !== null && Number(statusCounts.marked) >= 0) {
      return Number(statusCounts.marked);
    }
    return students.filter((s) => Boolean(s.section && String(s.section).trim())).length;
  }, [statusCounts, students]);

  const notMarkedCount = useMemo(() => {
    if (statusCounts?.notMarked !== undefined && statusCounts.notMarked !== null && Number(statusCounts.notMarked) >= 0) {
      return Number(statusCounts.notMarked);
    }
    return students.filter((s) => !s.section || !String(s.section).trim()).length;
  }, [statusCounts, students]);

  const batchTotalCount = useMemo(() => {
    if (statusCounts?.all) return Number(statusCounts.all);
    return totalStudents || students.length;
  }, [statusCounts, totalStudents, students.length]);

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

  // Section breakdown limits the maximum number of sections dynamically
  const hasConfiguredBreakdown = breakdownList.length > 0;
  const maxSectionsAllowed = hasConfiguredBreakdown ? breakdownList.length : 10;
  const initialSectionCount = hasConfiguredBreakdown ? breakdownList.length : 2;

  const [numberOfSections, setNumberOfSections] = useState(initialSectionCount);
  const [sections, setSections] = useState([]);
  const [isApplying, setIsApplying] = useState(false);
  const autoInitializedRef = useRef(false);

  // Initialize or re-initialize sections when modal opens
  useEffect(() => {
    if (!isOpen) {
      autoInitializedRef.current = false;
      return;
    }

    const count = Math.min(initialSectionCount, maxSectionsAllowed);
    setNumberOfSections(count);

    const initialSections = Array.from({ length: count }, (_, idx) => {
      const defaultName =
        availableSectionNames[idx] ||
        (idx < 26 ? `Section ${String.fromCharCode(65 + idx)}` : `Section ${idx + 1}`);
      return {
        id: `sec-${Date.now()}-${idx}`,
        section: defaultName,
        ranges: [
          {
            id: `range-${Date.now()}-${idx}-0`,
            startPin: '',
            endPin: ''
          }
        ]
      };
    });

    setSections(initialSections);
  }, [isOpen, initialSectionCount, maxSectionsAllowed, availableSectionNames]);

  // Flattened ranges across all sections for stats and validation
  const flatRanges = useMemo(() => {
    return sections.flatMap((sec) =>
      sec.ranges.map((r) => ({
        id: r.id,
        sectionId: sec.id,
        section: sec.section,
        startPin: r.startPin,
        endPin: r.endPin
      }))
    );
  }, [sections]);

  // Calculate real-time stats
  const stats = useMemo(() => {
    return calculateSectionRangeStats(students, flatRanges);
  }, [students, flatRanges]);

  // Helper to map section-level aggregated statistics
  const sectionSummaryMap = useMemo(() => {
    const map = new Map();
    (stats.sectionSummaries || []).forEach((item) => {
      map.set(item.section, item);
    });
    return map;
  }, [stats.sectionSummaries]);

  // Auto-fill ranges if empty when students are loaded and modal is opened
  useEffect(() => {
    if (!isOpen || autoInitializedRef.current) return;
    if (sections.length === 0 || stats.sortedStudentsWithPin.length === 0) return;

    const allEmpty = flatRanges.every((r) => !r.startPin && !r.endPin);
    if (!allEmpty) return;

    const distributed = distributeStudentsIntoSections(
      stats.sortedStudentsWithPin,
      sections.length,
      breakdownList
    );

    if (distributed.length > 0) {
      setSections((prev) =>
        prev.map((sec, idx) => {
          const item = distributed[idx];
          return {
            ...sec,
            ranges: [
              {
                id: sec.ranges[0]?.id || `range-${Date.now()}-${idx}-0`,
                startPin: item ? item.startPin || '' : '',
                endPin: item ? item.endPin || '' : ''
              }
            ]
          };
        })
      );
      autoInitializedRef.current = true;
    }
  }, [isOpen, sections.length, flatRanges, stats.sortedStudentsWithPin, breakdownList]);

  // Handle changing the number of sections
  const handleSectionCountChange = (newCount) => {
    const targetCount = Math.max(1, Math.min(maxSectionsAllowed, parseInt(newCount, 10) || 1));
    setNumberOfSections(targetCount);

    const sortedStudents = stats.sortedStudentsWithPin;
    const distributed =
      sortedStudents.length > 0
        ? distributeStudentsIntoSections(sortedStudents, targetCount, breakdownList)
        : [];

    setSections((prev) => {
      const nextSections = [];
      for (let i = 0; i < targetCount; i++) {
        const existingSec = prev[i];
        const usedNames = new Set(nextSections.map((s) => s.section));
        const sectionName =
          existingSec?.section && !usedNames.has(existingSec.section)
            ? existingSec.section
            : availableSectionNames.find((name) => !usedNames.has(name)) ||
              availableSectionNames[i] ||
              (i < 26 ? `Section ${String.fromCharCode(65 + i)}` : `Section ${i + 1}`);

        const item = distributed[i];
        const initialRanges = existingSec?.ranges?.length
          ? existingSec.ranges.map((r, rIdx) =>
              rIdx === 0 && item
                ? { ...r, startPin: item.startPin || '', endPin: item.endPin || '' }
                : r
            )
          : [
              {
                id: `range-${Date.now()}-${i}-0`,
                startPin: item ? item.startPin || '' : '',
                endPin: item ? item.endPin || '' : ''
              }
            ];

        nextSections.push({
          id: existingSec?.id || `sec-${Date.now()}-${i}`,
          section: sectionName,
          ranges: initialRanges
        });
      }
      return nextSections;
    });
  };

  // Add a new section row
  const handleAddSectionRow = () => {
    if (sections.length >= maxSectionsAllowed) {
      toast.error(
        hasConfiguredBreakdown
          ? `Cannot exceed ${maxSectionsAllowed} sections configured in section breakdown for this branch`
          : 'Maximum 10 sections allowed'
      );
      return;
    }
    const nextCount = sections.length + 1;
    handleSectionCountChange(nextCount);
  };

  // Remove a section row
  const handleRemoveSectionRow = (sectionId) => {
    if (sections.length <= 1) {
      toast.error('At least one section is required');
      return;
    }
    const remainingSections = sections.filter((s) => s.id !== sectionId);
    const targetCount = remainingSections.length;
    setNumberOfSections(targetCount);

    const sortedStudents = stats.sortedStudentsWithPin;
    const distributed =
      sortedStudents.length > 0
        ? distributeStudentsIntoSections(sortedStudents, targetCount, breakdownList)
        : [];

    setSections(
      remainingSections.map((sec, idx) => {
        const item = distributed[idx];
        return {
          ...sec,
          ranges: sec.ranges.map((r, rIdx) =>
            rIdx === 0 && item
              ? { ...r, startPin: item.startPin || '', endPin: item.endPin || '' }
              : r
          )
        };
      })
    );
  };

  // Update section name
  const handleSectionNameChange = (sectionId, newName) => {
    setSections((prev) =>
      prev.map((sec) => (sec.id === sectionId ? { ...sec, section: newName } : sec))
    );
  };

  // Add another PIN range to a specific section (Multi-range selection support!)
  const handleAddPinRangeToSection = (sectionId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const newRange = {
          id: `range-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          startPin: '',
          endPin: ''
        };
        return {
          ...sec,
          ranges: [...sec.ranges, newRange]
        };
      })
    );
    toast.success('Added new PIN range row. Select Start and End PIN from available students.');
  };

  // Remove or clear a PIN range from a specific section
  const handleRemovePinRangeFromSection = (sectionId, rangeId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        if (sec.ranges.length <= 1) {
          // Clear inputs if it's the only range
          return {
            ...sec,
            ranges: sec.ranges.map((r) =>
              r.id === rangeId ? { ...r, startPin: '', endPin: '' } : r
            )
          };
        }
        // Remove range if there are multiple ranges
        return {
          ...sec,
          ranges: sec.ranges.filter((r) => r.id !== rangeId)
        };
      })
    );
  };

  // Update a specific range property (startPin / endPin)
  const handleRangeFieldChange = (sectionId, rangeId, field, value) => {
    const formattedVal = String(value || '').trim().toUpperCase();

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          ranges: sec.ranges.map((r) => {
            if (r.id !== rangeId) return r;
            const updated = { ...r, [field]: formattedVal };

            // If startPin changed, verify that existing endPin is still >= startPin; if not, clear endPin
            if (field === 'startPin') {
              if (updated.endPin) {
                const sIdx = stats.sortedStudentsWithPin.findIndex(
                  (s) => s.pinNo === formattedVal
                );
                const eIdx = stats.sortedStudentsWithPin.findIndex(
                  (s) => s.pinNo === updated.endPin
                );
                if (sIdx === -1 || eIdx === -1 || eIdx < sIdx) {
                  updated.endPin = '';
                }
              }
            }
            return updated;
          })
        };
      })
    );
  };

  // Auto-distribute across sections (uses breakdown capacities if configured)
  const handleAutoDistribute = () => {
    if (stats.sortedStudentsWithPin.length === 0) {
      toast.error('No students with PIN numbers found in this batch');
      return;
    }

    const distributed = distributeStudentsIntoSections(
      stats.sortedStudentsWithPin,
      sections.length,
      breakdownList
    );

    setSections((prev) =>
      prev.map((sec, idx) => {
        const item = distributed[idx];
        return {
          ...sec,
          ranges: [
            {
              id: sec.ranges[0]?.id || `range-${Date.now()}-${idx}-0`,
              startPin: item ? item.startPin || '' : '',
              endPin: item ? item.endPin || '' : ''
            }
          ]
        };
      })
    );

    const hasBreaks = breakdownList.some((b) => Number(b.strength) > 0);
    toast.success(
      hasBreaks
        ? `Distributed ${stats.sortedStudentsWithPin.length} students across ${sections.length} sections based on section breakdown`
        : `Distributed ${stats.sortedStudentsWithPin.length} students across ${sections.length} sections`
    );
  };

  // Clear all PIN ranges
  const handleClearRanges = () => {
    setSections((prev) =>
      prev.map((sec, idx) => ({
        ...sec,
        ranges: [
          {
            id: sec.ranges[0]?.id || `range-${Date.now()}-${idx}-0`,
            startPin: '',
            endPin: ''
          }
        ]
      }))
    );
  };

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

  // Collect assignment pairs { admissionNumber, section }
  const getAssignments = () => {
    const validRanges = flatRanges.filter((r) => r.section && r.startPin && r.endPin);
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
      const validFlatRanges = flatRanges
        .filter((r) => r.section && r.startPin && r.endPin)
        .map((r) => ({
          section: r.section,
          startPin: r.startPin,
          endPin: r.endPin
        }));

      await onSaveDirectly(assignments, validFlatRanges);
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
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 id="pin-separation-title" className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Section Separation by PIN Range
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                <span className="font-semibold text-blue-700">{filters.course || 'Course'}</span>
                <span>•</span>
                <span className="font-medium text-gray-700">{filters.branch || 'Branch'}</span>
                <span>•</span>
                <span className="bg-blue-50 text-blue-700 font-medium px-1.5 py-0.5 rounded border border-blue-100">
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
                <span>•</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-xs ${
                    filters.sectionStatus === 'marked'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : filters.sectionStatus === 'not_marked'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {filters.sectionStatus === 'marked'
                    ? `Section Marked Only (${stats.totalStudents})`
                    : filters.sectionStatus === 'not_marked'
                    ? `Not Marked Only (${stats.totalStudents})`
                    : `All Students (${stats.totalStudents})`}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {loadingAllStudents ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-500">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm font-medium">
                {filters.sectionStatus === 'not_marked'
                  ? 'Loading unassigned students for PIN range calculation...'
                  : filters.sectionStatus === 'marked'
                  ? 'Loading section-marked students for PIN range calculation...'
                  : 'Loading all batch students for PIN range calculation...'}
              </p>
            </div>
          ) : (
            <>
              {/* Batch PIN Stats Overview Cards (Consistent with Students.jsx) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Total Students</p>
                      <p className="text-lg font-bold text-blue-600 leading-tight">
                        {batchTotalCount.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-0.5 truncate">
                        {stats.withPinCount} with PIN{stats.withPinCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-1.5 rounded-lg shrink-0">
                      <Users className="text-blue-500" size={14} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Section Marked</p>
                      <p className="text-lg font-bold text-emerald-600 leading-tight">
                        {markedCount.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-emerald-600 mt-0.5 font-medium truncate">
                        {batchTotalCount > 0 ? `${Math.round((markedCount / batchTotalCount) * 100)}% of batch` : 'Assigned'}
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-1.5 rounded-lg shrink-0">
                      <CheckCircle2 className="text-emerald-500" size={14} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Not Marked</p>
                      <p className="text-lg font-bold text-amber-600 leading-tight">
                        {notMarkedCount.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-amber-600 mt-0.5 font-medium truncate">
                        {batchTotalCount > 0 ? `${Math.round((notMarkedCount / batchTotalCount) * 100)}% pending` : 'Pending'}
                      </p>
                    </div>
                    <div className="bg-amber-50 p-1.5 rounded-lg shrink-0">
                      <AlertCircle className="text-amber-500" size={14} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">PIN Range</p>
                      <p className="text-xs font-bold font-mono text-gray-900 leading-tight truncate" title={`${stats.minPin || 'N/A'} - ${stats.maxPin || 'N/A'}`}>
                        {stats.minPin ? `${stats.minPin} → ${stats.maxPin}` : 'No PINs'}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-0.5 truncate">
                        Lowest to Highest
                      </p>
                    </div>
                    <div className="bg-blue-50 p-1.5 rounded-lg shrink-0">
                      <Hash className="text-blue-500" size={14} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Total Matched</p>
                      <p className="text-lg font-bold text-emerald-600 leading-tight">
                        {stats.totalMatched}
                        <span className="text-xs font-normal text-gray-400 ml-1">
                          /{stats.withPinCount}
                        </span>
                      </p>
                      <p className="text-[9px] text-emerald-600 mt-0.5 font-medium truncate">
                        {stats.withPinCount > 0
                          ? `${Math.round((stats.totalMatched / stats.withPinCount) * 100)}% covered`
                          : '0%'}
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-1.5 rounded-lg shrink-0">
                      <Layers className="text-emerald-500" size={14} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Unmatched</p>
                      <p className={`text-lg font-bold leading-tight ${stats.unmatchedCount > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                        {stats.unmatchedCount}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-0.5 truncate">
                        {stats.noPinCount > 0 ? `${stats.noPinCount} with no PIN` : 'Will remain'}
                      </p>
                    </div>
                    <div className={`p-1.5 rounded-lg shrink-0 ${stats.unmatchedCount > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <AlertTriangle className={stats.unmatchedCount > 0 ? 'text-amber-500' : 'text-gray-400'} size={14} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Number of Sections Selector and Auto-Distribute Toolbar */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label htmlFor="num-sections-input" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                        Number of Sections to Separate
                      </label>
                      {hasConfiguredBreakdown && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                          Breakdown Limit: Max {maxSectionsAllowed}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center border border-gray-300 rounded-lg bg-white shadow-xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleSectionCountChange(sections.length - 1)}
                          disabled={sections.length <= 1}
                          className="px-3 py-1 text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Decrease section count"
                        >
                          -
                        </button>
                        <input
                          id="num-sections-input"
                          type="number"
                          min="1"
                          max={maxSectionsAllowed}
                          value={sections.length}
                          onChange={(e) => handleSectionCountChange(e.target.value)}
                          className="w-14 text-center py-1 text-sm font-bold text-gray-900 border-x border-gray-200 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSectionCountChange(sections.length + 1)}
                          disabled={sections.length >= maxSectionsAllowed}
                          className="px-3 py-1 text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Increase section count"
                          title={
                            sections.length >= maxSectionsAllowed
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
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border border-transparent shadow-sm hover:shadow active:scale-95 transition-all duration-300 min-h-[34px] disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      hasConfiguredBreakdown
                        ? 'Distribute students across sections according to configured section breakdown strengths'
                        : 'Evenly divides regular students across sections by sorted PIN'
                    }
                  >
                    <Sparkles size={14} />
                    <span>Auto-Distribute Ranges</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearRanges}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium shadow-xs transition-colors min-h-[34px]"
                    title="Clear Start and End PIN inputs"
                  >
                    <RotateCcw size={14} />
                    <span>Clear</span>
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
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                  <span>Sections & Multi PIN Number Ranges</span>
                  <span>Section Totals</span>
                </div>

                {sections.map((sec, secIndex) => {
                  const secStat = sectionSummaryMap.get(sec.section) || {
                    count: 0,
                    percentage: 0
                  };
                  const targetConfig = getBreakdownTargetRange(secIndex);

                  return (
                    <div
                      key={sec.id}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        secStat.count > 0
                          ? 'border-blue-200 bg-white shadow-xs'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {/* Section Card Top Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-md bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                            {secIndex + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            {availableSectionNames.length > 0 ? (
                              <select
                                value={sec.section}
                                onChange={(e) => handleSectionNameChange(sec.id, e.target.value)}
                                className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                {breakdownList.map((item) => (
                                  <option key={item.name} value={item.name}>
                                    Section {item.name}{item.strength ? ` (${item.strength} students)` : ''}
                                  </option>
                                ))}
                                {!availableSectionNames.includes(sec.section) && (
                                  <option value={sec.section}>{sec.section}</option>
                                )}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={sec.section}
                                onChange={(e) => handleSectionNameChange(sec.id, e.target.value)}
                                placeholder="Section Name (e.g. A)"
                                className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-36"
                              />
                            )}

                            {targetConfig && (
                              <span
                                className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md"
                                title={`Target breakdown strength: ${targetConfig.strength} students`}
                              >
                                Cap: {targetConfig.strength}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Section Total Count & Actions */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {secStat.count > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
                                <Check size={13} className="text-emerald-600" />
                                {secStat.count} Student{secStat.count === 1 ? '' : 's'}
                                <span className="text-[10px] font-semibold text-emerald-600 border-l border-emerald-200 pl-1.5">
                                  {secStat.percentage}%
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                0 Students
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                              <Layers size={12} />
                              {sec.ranges.length} Range{sec.ranges.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          {sections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSectionRow(sec.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              title={`Remove Section ${sec.section}`}
                              aria-label={`Remove Section ${sec.section}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Section Ranges List */}
                      <div className="p-4 space-y-3 bg-white">
                        {sec.ranges.map((range, rangeIndex) => {
                          const rangeStat = stats.sectionCounts.find((s) => s.id === range.id) || {
                            count: 0,
                            percentage: 0,
                            isInvalidRange: false
                          };

                          const startSerial = getSerialForPin(range.startPin, false);
                          const endSerial = getSerialForPin(range.endPin, true);

                          // Compute available range options strictly excluding other selected ranges
                          const { availableStartStudents, availableEndStudents } =
                            getAvailableRangeOptions(
                              stats.sortedStudentsWithPin,
                              flatRanges,
                              range.id,
                              range.startPin,
                              range.endPin
                            );

                          return (
                            <div
                              key={range.id}
                              className={`p-3 rounded-lg border transition-all ${
                                rangeStat.isInvalidRange
                                  ? 'border-rose-300 bg-rose-50/30'
                                  : rangeStat.count > 0
                                  ? 'border-blue-100 bg-blue-50/20'
                                  : 'border-gray-200/80 bg-gray-50/40'
                              }`}
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                {/* Range Index Tag */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[11px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
                                    Range {rangeIndex + 1}
                                  </span>
                                </div>

                                {/* From (Start PIN) and To (End PIN) Select Dropdowns */}
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:items-center">
                                  {/* From (Start PIN) */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                        From (Start PIN)
                                      </label>
                                      {startSerial !== null && (
                                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                          S.No #{startSerial}
                                        </span>
                                      )}
                                    </div>
                                    <select
                                      value={range.startPin}
                                      onChange={(e) =>
                                        handleRangeFieldChange(
                                          sec.id,
                                          range.id,
                                          'startPin',
                                          e.target.value
                                        )
                                      }
                                      className="w-full font-mono border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    >
                                      <option value="">
                                        {availableStartStudents.length > 0
                                          ? '-- Select Start PIN --'
                                          : '-- All students allocated in existing ranges --'}
                                      </option>
                                      {availableStartStudents.map((student) => {
                                          const sNo = getSerialForPin(student.pinNo, false);
                                          const isLateral =
                                            student.studType &&
                                            ['LATER', 'LSPOT', 'L.E'].includes(
                                              String(student.studType).trim().toUpperCase()
                                            );
                                          return (
                                            <option
                                              key={`start-${range.id}-${student.pinNo}`}
                                              value={student.pinNo}
                                            >
                                              {sNo ? `${sNo}. ` : ''}
                                              {student.pinNo}
                                              {isLateral ? ' [Lateral]' : ''}
                                              {student.studentName
                                                ? ` - ${student.studentName.slice(0, 32)}`
                                                : ''}
                                            </option>
                                          );
                                      })}
                                      {range.startPin &&
                                        !availableStartStudents.some(
                                          (s) => s.pinNo === range.startPin
                                        ) && (
                                          <option value={range.startPin}>
                                            {getSerialForPin(range.startPin)
                                              ? `${getSerialForPin(range.startPin)}. `
                                              : ''}
                                            {range.startPin}
                                          </option>
                                        )}
                                    </select>
                                  </div>

                                  {/* To (End PIN) */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                        To (End PIN)
                                      </label>
                                      {endSerial !== null && (
                                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                          S.No #{endSerial}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        value={range.endPin}
                                        disabled={!range.startPin}
                                        onChange={(e) =>
                                          handleRangeFieldChange(
                                            sec.id,
                                            range.id,
                                            'endPin',
                                            e.target.value
                                          )
                                        }
                                        className="w-full font-mono border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                      >
                                        <option value="">
                                          {!range.startPin
                                            ? '-- Select Start PIN First --'
                                            : availableEndStudents.length > 0
                                            ? '-- Select End PIN --'
                                            : '-- No valid End PINs in range --'}
                                        </option>
                                        {availableEndStudents.map((student) => {
                                          const sNo = getSerialForPin(student.pinNo, true);
                                          const isLateral =
                                            student.studType &&
                                            ['LATER', 'LSPOT', 'L.E'].includes(
                                              String(student.studType).trim().toUpperCase()
                                            );
                                          return (
                                            <option
                                              key={`end-${range.id}-${student.pinNo}`}
                                              value={student.pinNo}
                                            >
                                              {sNo ? `${sNo}. ` : ''}
                                              {student.pinNo}
                                              {isLateral ? ' [Lateral]' : ''}
                                              {student.studentName
                                                ? ` - ${student.studentName.slice(0, 32)}`
                                                : ''}
                                            </option>
                                          );
                                        })}
                                        {range.endPin &&
                                          !availableEndStudents.some(
                                            (s) => s.pinNo === range.endPin
                                          ) && (
                                            <option value={range.endPin}>
                                              {getSerialForPin(range.endPin, true)
                                                ? `${getSerialForPin(range.endPin, true)}. `
                                                : ''}
                                              {range.endPin}
                                            </option>
                                          )}
                                      </select>

                                      {/* Delete / Clear Range button */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemovePinRangeFromSection(sec.id, range.id)
                                        }
                                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                                        title={
                                          sec.ranges.length > 1
                                            ? 'Remove this PIN range'
                                            : 'Clear Start and End PIN'
                                        }
                                        aria-label="Remove PIN range"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Range Student Count / Serial Indicator */}
                                <div className="lg:w-44 flex lg:flex-col lg:items-end justify-between items-center shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0">
                                  {rangeStat.isInvalidRange ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                                      <AlertCircle size={12} />
                                      Start &gt; End PIN
                                    </span>
                                  ) : rangeStat.count > 0 ? (
                                    <div className="text-right">
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                                        <Check size={11} className="text-emerald-600" />
                                        {rangeStat.count} Student{rangeStat.count === 1 ? '' : 's'}
                                      </span>
                                      {startSerial && endSerial && (
                                        <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                                          S.No {startSerial} → {endSerial}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-xs font-medium">
                                      0 Students
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add Another Number Range to This Section Button */}
                        <div className="pt-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleAddPinRangeToSection(sec.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-blue-300 text-blue-700 hover:text-blue-900 bg-blue-50/40 hover:bg-blue-100/60 text-xs font-bold transition-all"
                            title={`Add another PIN range to Section ${sec.section} (e.g. lateral entry, transfer, or another roll series)`}
                          >
                            <Plus size={14} />
                            + Add Another Range to Section {sec.section}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Section Button - Clamped to Breakdown */}
              {sections.length < maxSectionsAllowed ? (
                <button
                  type="button"
                  onClick={handleAddSectionRow}
                  className="w-full py-2 px-4 rounded-xl border border-dashed border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus size={16} />
                  Add Another Section
                </button>
              ) : hasConfiguredBreakdown ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs text-gray-500 font-medium">
                  Maximum limit reached: {maxSectionsAllowed} of {maxSectionsAllowed} sections configured in section breakdown for {filters.branch || 'this branch'}
                </div>
              ) : null}

              {/* Partition Scope & Missing PIN notes */}
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                <div>
                  <span className="font-semibold text-gray-800">Partition Scope:</span>{' '}
                  {filters.sectionStatus === 'not_marked' ? (
                    <>
                      Partitioning only the <span className="font-bold text-gray-900">{stats.totalStudents}</span> unassigned (not marked) students into sections. Existing sections of other students will remain untouched.
                    </>
                  ) : filters.sectionStatus === 'marked' ? (
                    <>
                      Re-partitioning only the <span className="font-bold text-gray-900">{stats.totalStudents}</span> students who currently have sections marked.
                    </>
                  ) : (
                    <>
                      Partitioning all <span className="font-bold text-gray-900">{stats.totalStudents}</span> batch students into sections by PIN range.
                    </>
                  )}
                </div>
                {stats.noPinCount > 0 && (
                  <div className="text-amber-700">
                    • {stats.noPinCount} student(s) do not have a PIN number assigned and will retain their current sections.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-gray-200 bg-gray-50 rounded-b-2xl shrink-0">
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
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 min-h-[34px] shadow-xs transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplyToDraft}
              disabled={isApplying || saving || stats.totalMatched === 0}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 min-h-[34px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Apply section changes to table rows so you can review before saving"
            >
              Apply to Table (Review)
            </button>

            <button
              type="button"
              onClick={handleSaveDirect}
              disabled={isApplying || saving || stats.totalMatched === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border border-transparent shadow-sm hover:shadow active:scale-95 transition-all duration-300 min-h-[34px] disabled:opacity-50 disabled:cursor-not-allowed"
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
