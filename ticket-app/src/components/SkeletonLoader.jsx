import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const SkeletonBox = ({
    width,
    height,
    className,
    rounded = 'rounded'
}) => {
    return (
        <div
            className={twMerge(
                clsx(
                    'animate-pulse bg-gray-200',
                    width || 'w-full',
                    height || 'h-4',
                    rounded,
                    className
                )
            )}
        />
    );
};

export const SkeletonCircle = ({ size = 10, className }) => {
    return (
        <div
            className={twMerge(
                clsx(
                    'animate-pulse bg-gray-200 rounded-full',
                    `w-${size} h-${size}`,
                    className
                )
            )}
            style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }}
        />
    );
};

export const PageHeaderSkeleton = () => (
    <div className="space-y-2 mb-6">
        <SkeletonBox width="w-48" height="h-8" />
        <SkeletonBox width="w-64" height="h-4" />
    </div>
);

export const StatsGridSkeleton = ({ count = 4 }) => (
    <div className={`grid grid-cols-1 md:grid-cols-${count > 4 ? 5 : count} gap-4 mb-6`}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <SkeletonBox width="w-20" height="h-4" className="mb-2" />
                        <SkeletonBox width="w-12" height="h-8" />
                    </div>
                    <SkeletonCircle size={10} />
                </div>
            </div>
        ))}
    </div>
);

export const TableSkeleton = ({ rows = 5, columns = 5, className }) => (
    <div className={twMerge(clsx("bg-white rounded-lg border overflow-hidden", className))}>
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="px-6 py-3">
                                <SkeletonBox width="w-24" height="h-4" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {Array.from({ length: rows }).map((_, i) => (
                        <tr key={i}>
                            {Array.from({ length: columns }).map((_, j) => (
                                <td key={j} className="px-6 py-4">
                                    <SkeletonBox width="w-full" height="h-4" />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export const FiltersSkeleton = () => (
    <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                    <SkeletonBox width="w-16" height="h-4" className="mb-2" />
                    <SkeletonBox width="w-full" height="h-10" />
                </div>
            ))}
        </div>
    </div>
);

export const TicketManagementSkeleton = () => (
    <div className="space-y-6">
        <StatsGridSkeleton count={5} />
        <FiltersSkeleton />
        <TableSkeleton rows={10} columns={8} />
    </div>
);

export const DashboardSkeleton = () => (
    <div className="space-y-6 p-6">
        <StatsGridSkeleton count={4} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border p-4 h-24 flex items-center gap-4 shadow-sm">
                    <SkeletonCircle size={12} />
                    <div className="flex-1">
                        <SkeletonBox width="w-32" height="h-5" className="mb-2" />
                        <SkeletonBox width="w-48" height="h-4" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const TreeSkeleton = () => (
    <div className="space-y-6 p-6">
        <div className="flex justify-between items-center mb-6">
            <PageHeaderSkeleton />
            <SkeletonBox width="w-32" height="h-10" />
        </div>
        <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
                <SkeletonBox width="w-40" height="h-6" className="mb-2" />
                <SkeletonBox width="w-80" height="h-4" />
            </div>
            <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                            <div className="flex gap-4 items-center w-full">
                                <SkeletonBox width="w-6" height="h-6" />
                                <div className="space-y-2 w-full">
                                    <SkeletonBox width="w-48" height="h-5" />
                                    <SkeletonBox width="w-64" height="h-4" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <SkeletonBox width="w-8" height="h-8" rounded="rounded-lg" />
                                <SkeletonBox width="w-8" height="h-8" rounded="rounded-lg" />
                                <SkeletonBox width="w-8" height="h-8" rounded="rounded-lg" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export const TaskManagementSkeleton = () => (
    <div className="space-y-6">
        <div className="bg-white rounded-lg border overflow-hidden">
            {/* Tabs mock */}
            <div className="border-b p-4 flex gap-4">
                <SkeletonBox width="w-32" height="h-10" />
                <SkeletonBox width="w-48" height="h-10" />
                <SkeletonBox width="w-32" height="h-10" />
            </div>
            {/* Filters mock */}
            <div className="border-b p-4 flex gap-4">
                <SkeletonBox width="w-64" height="h-10" />
                <SkeletonBox width="w-48" height="h-10" />
            </div>
            {/* Table */}
            <TableSkeleton rows={10} columns={5} className="border-none rounded-none" />
        </div>
    </div>
);

export const StudentDashboardSkeleton = () => (
    <div className="space-y-6 pb-6 animate-pulse">
        <StatsGridSkeleton count={4} />
        <div className="dashboard-main-grid">
            <div className="col-span-8 flex flex-col gap-4">
                <div className="flex justify-between mb-4">
                    <SkeletonBox width="w-32" height="h-6" />
                    <SkeletonBox width="w-20" height="h-4" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg border h-20 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <SkeletonCircle size={12} />
                            <div>
                                <SkeletonBox width="w-48" height="h-5" className="mb-2" />
                                <SkeletonBox width="w-32" height="h-4" />
                            </div>
                        </div>
                        <SkeletonBox width="w-20" height="h-6" rounded="rounded-full" />
                    </div>
                ))}
            </div>

            <div className="col-span-4 flex flex-col gap-6">
                <SkeletonBox width="w-32" height="h-6" />
                <SkeletonBox width="w-full" height="h-48" rounded="rounded-lg" />
                <SkeletonBox width="w-full" height="h-32" rounded="rounded-lg" />
            </div>
        </div>
    </div>
);
