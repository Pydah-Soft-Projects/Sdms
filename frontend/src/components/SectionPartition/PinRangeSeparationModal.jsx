import React, { useState, useEffect, useMemo } from 'react';
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
  students = [],
  totalStudents = 0,
  loadingAllStudents = false,
  onApplyDraft,
  onSaveDirectly,
  saving = false
}) => {
  // Normalize configured section names list (e.g. ['A', 'B'] or ['Section A', 'Section B'])
  const availableSectionNames = useMemo(() => {
    return (configuredSections || [])
      .map((item) => (typeof item === 'object' ? item?.name || item?.id : item))
      .filter(Boolean);
  }, [configuredSections]);

  // Default number of sections: always 2 by default
  const initialSectionCount = 2;

  const [numberOfSections, setNumberOfSections] = useState(2);
  const [ranges, setRanges] = useState([]);
  const [isApplying, setIsApplying] = useState(false);

  // Initialize or re-initialize ranges when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const count = initialSectionCount;
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
  }, [isOpen, initialSectionCount, availableSectionNames]);

  // Handle changing the number of sections
  const handleSectionCountChange = (newCount) => {
    const targetCount = Math.max(1, Math.min(10, parseInt(newCount, 10) || 1));
    setNumberOfSections(targetCount);

    setRanges((prev) => {
      if (targetCount === prev.length) return prev;

      if (targetCount > prev.length) {
        const added = [];
        for (let i = prev.length; i < targetCount; i++) {
          const defaultName =
            availableSectionNames[i] ||
            (i < 26 ? `Section ${String.fromCharCode(65 + i)}` : `Section ${i + 1}`);
          added.push({
            id: `range-${Date.now()}-${i}`,
            section: defaultName,
            startPin: '',
            endPin: ''
          });
        }
        return [...prev, ...added];
      }

      // If reducing, trim from end
      return prev.slice(0, targetCount);
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

  // Add a new section range row
  const handleAddSectionRow = () => {
    if (ranges.length >= 10) {
      toast.error('Maximum 10 sections allowed');
      return;
    }
    const nextIdx = ranges.length;
    const defaultName =
      availableSectionNames[nextIdx] ||
      (nextIdx < 26 ? `Section ${String.fromCharCode(65 + nextIdx)}` : `Section ${nextIdx + 1}`);

    setRanges((prev) => [
      ...prev,
      {
        id: `range-${Date.now()}-${nextIdx}`,
        section: defaultName,
        startPin: '',
        endPin: ''
      }
    ]);
    setNumberOfSections((prev) => prev + 1);
  };

  // Remove a section range row
  const handleRemoveSectionRow = (id) => {
    if (ranges.length <= 1) {
      toast.error('At least one section is required');
      return;
    }
    setRanges((prev) => prev.filter((r) => r.id !== id));
    setNumberOfSections((prev) => Math.max(1, prev - 1));
  };

  // Calculate real-time stats
  const stats = useMemo(() => {
    return calculateSectionRangeStats(students, ranges);
  }, [students, ranges]);

  // Auto-distribute evenly across sections in PIN order
  const handleAutoDistribute = () => {
    if (stats.sortedStudentsWithPin.length === 0) {
      toast.error('No students with PIN numbers found in this batch');
      return;
    }

    const distributed = distributeStudentsIntoSections(
      stats.sortedStudentsWithPin,
      ranges.length
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

    toast.success(
      `Distributed ${stats.sortedStudentsWithPin.length} students across ${ranges.length} sections`
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
                    <label htmlFor="num-sections-input" className="block text-xs font-bold uppercase tracking-wider text-indigo-900 mb-1">
                      Number of Sections to Separate
                    </label>
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
                          max="10"
                          value={numberOfSections}
                          onChange={(e) => handleSectionCountChange(e.target.value)}
                          className="w-14 text-center py-1.5 text-sm font-bold text-gray-900 border-x border-indigo-100 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSectionCountChange(numberOfSections + 1)}
                          disabled={numberOfSections >= 10}
                          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Increase section count"
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
                    title="Evenly divides regular students across sections by sorted PIN"
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
                            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Section Name
                            </label>
                            {availableSectionNames.length > 0 ? (
                              <select
                                value={range.section}
                                onChange={(e) =>
                                  handleRangeFieldChange(range.id, 'section', e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                {availableSectionNames.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
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

                        {/* PIN Range Inputs: Start to End */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:items-center">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              From (Start PIN)
                            </label>
                            <input
                              type="text"
                              value={range.startPin}
                              onChange={(e) =>
                                handleRangeFieldChange(range.id, 'startPin', e.target.value)
                              }
                              placeholder={stats.minPin ? `e.g. ${stats.minPin}` : 'Start PIN'}
                              className="w-full uppercase font-mono border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              To (End PIN)
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={range.endPin}
                                onChange={(e) =>
                                  handleRangeFieldChange(range.id, 'endPin', e.target.value)
                                }
                                placeholder={stats.maxPin ? `e.g. ${stats.maxPin}` : 'End PIN'}
                                className="w-full uppercase font-mono border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                              {ranges.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSectionRow(range.id)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
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
                        <div className="lg:w-44 flex lg:flex-col lg:items-end justify-between items-center shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0">
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

              {/* Add Section Button */}
              {ranges.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddSectionRow}
                  className="w-full py-2.5 px-4 rounded-xl border border-dashed border-gray-300 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus size={16} />
                  Add Another Section
                </button>
              )}

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
