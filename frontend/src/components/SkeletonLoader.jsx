import React from 'react';

// Skeleton loader component for modern loading states
export const SkeletonBox = ({ className = '', height = 'h-4', width = 'w-full' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${height} ${width} ${className}`} />
);

export const SkeletonCard = () => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3 mb-3">
      <SkeletonBox height="h-10" width="w-10" className="rounded-full" />
      <div className="flex-1 space-y-2">
        <SkeletonBox height="h-4" width="w-3/4" />
        <SkeletonBox height="h-3" width="w-1/2" />
      </div>
    </div>
    <div className="space-y-2">
      <SkeletonBox height="h-3" />
      <SkeletonBox height="h-3" width="w-5/6" />
    </div>
  </div>
);

export const SkeletonList = ({ count = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200">
        <SkeletonBox height="h-2" width="w-2" className="rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBox height="h-4" width="w-1/3" />
          <SkeletonBox height="h-3" width="w-1/4" />
        </div>
        <SkeletonBox height="h-4" width="w-16" />
      </div>
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-2">
    {/* Header */}
    <div className="flex gap-4 pb-2 border-b border-gray-200">
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBox key={i} height="h-4" width="w-24" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="flex gap-4 py-3">
        {Array.from({ length: cols }).map((_, colIdx) => (
          <SkeletonBox key={colIdx} height="h-4" width="w-24" />
        ))}
      </div>
    ))}
  </div>
);

// Skeleton for attendance table with more columns
export const SkeletonAttendanceTable = ({ rows = 10 }) => (
  <div className="space-y-0">
    {/* Header */}
    <div className="grid grid-cols-11 gap-2 pb-2 border-b border-gray-200 px-4 py-3 bg-gray-50">
      <SkeletonBox height="h-4" width="w-20" />
      <SkeletonBox height="h-4" width="w-16" />
      <SkeletonBox height="h-4" width="w-20" />
      <SkeletonBox height="h-4" width="w-24" />
      <SkeletonBox height="h-4" width="w-20" />
      <SkeletonBox height="h-4" width="w-16" />
      <SkeletonBox height="h-4" width="w-16" />
      <SkeletonBox height="h-4" width="w-24" />
      <SkeletonBox height="h-4" width="w-24" />
      <SkeletonBox height="h-4" width="w-20" />
      <SkeletonBox height="h-4" width="w-16" />
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="grid grid-cols-11 gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <SkeletonBox height="h-8" width="w-8" className="rounded-full" />
          <SkeletonBox height="h-4" width="w-32" />
        </div>
        <SkeletonBox height="h-4" width="w-16" />
        <SkeletonBox height="h-4" width="w-20" />
        <SkeletonBox height="h-4" width="w-24" />
        <SkeletonBox height="h-4" width="w-20" />
        <SkeletonBox height="h-4" width="w-12" />
        <SkeletonBox height="h-4" width="w-12" />
        <SkeletonBox height="h-4" width="w-24" />
        <SkeletonBox height="h-6" width="w-20" className="rounded-md" />
        <SkeletonBox height="h-4" width="w-16" />
        <SkeletonBox height="h-4" width="w-12" />
      </div>
    ))}
  </div>
);

// Skeleton for Students table with proper table structure
export const SkeletonStudentsTable = ({ rows = 10 }) => {
  const columns = [
    { width: 'w-12', sticky: 'left-0', isCheckbox: true }, // Checkbox
    { width: 'w-20', sticky: 'left-12', isPhoto: true }, // Photo (sticky at 48px = left-12)
    { width: 'w-40' }, // Student Name
    { width: 'w-28' }, // PIN Number
    { width: 'w-32' }, // Admission Number
    { width: 'w-24' }, // Batch
    { width: 'w-36' }, // College
    { width: 'w-32' }, // Course
    { width: 'w-32' }, // Branch
    { width: 'w-24' }, // Yr / Sem / Sec
    { width: 'w-28' }, // Student Type
    { width: 'w-24' }, // Status
    { width: 'w-28' }, // Scholar Status
    { width: 'w-24' }, // Caste
    { width: 'w-20' }, // Gender
    { width: 'w-32' }, // Certificate Status
    { width: 'w-32' }, // Remarks
  ];

  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full" style={{ tableLayout: 'auto' }}>
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`py-2 ${idx === 0 ? 'px-3' : 'px-1.5'} text-xs font-semibold text-gray-700 ${idx === 0 ? 'text-center' : 'text-left'} ${idx === 0 ? 'w-12' : idx === 1 ? 'min-w-[80px]' : ''} ${col.sticky ? `sticky ${col.sticky} bg-gray-50 z-20 border-r border-gray-200` : ''}`}
              >
                {idx === 0 ? (
                  <SkeletonBox height="h-4" width="w-4" className="rounded mx-auto" />
                ) : (
                  <SkeletonBox height="h-4" width={col.width} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-gray-100">
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={`py-2 ${colIdx === 0 ? 'px-3' : 'px-1.5'} ${colIdx === 0 ? 'text-center' : ''} ${col.sticky ? `sticky ${col.sticky} bg-white z-10 border-r border-gray-200` : ''}`}
                >
                  {col.isCheckbox ? (
                    <div className="flex justify-center">
                      <SkeletonBox height="h-4" width="w-4" className="rounded" />
                    </div>
                  ) : col.isPhoto ? (
                    <div className="flex items-center justify-center w-10 h-10">
                      <SkeletonBox height="h-10" width="w-10" className="rounded-full" />
                    </div>
                  ) : (
                    <SkeletonBox height="h-4" width={col.width} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

