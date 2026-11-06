import React from 'react';

const DashboardSkeleton = () => {
    return (
        <div className="space-y-4 sm:space-y-6 bg-gradient-to-br from-[var(--background)] via-surface to-[var(--primary-light)] min-h-screen">
            {/* Header Skeleton */}
            <div className="mb-4 sm:mb-6 lg:mb-8 animate-pulse">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="w-12 h-12 rounded-lg sm:rounded-xl bg-background flex-shrink-0"></div>
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-8 bg-background rounded w-1/3 sm:w-1/4"></div>
                        <div className="h-4 bg-background rounded w-1/2 sm:w-1/3 hidden sm:block"></div>
                    </div>
                </div>
            </div>

            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[...Array(4)].map((_, index) => (
                    <div
                        key={index}
                        className="relative overflow-hidden rounded-lg sm:rounded-xl bg-surface border border-border shadow-sm p-4 sm:p-6 animate-pulse"
                    >
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                            <div className="w-10 h-10 rounded-lg bg-background"></div>
                            <div className="w-12 h-5 rounded-full bg-background"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 bg-background rounded w-1/2"></div>
                            <div className="h-8 bg-background rounded w-3/4"></div>
                            <div className="h-3 bg-background rounded w-1/3"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions Skeleton */}
            <div className="bg-surface border border-border rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-6">
                <div className="h-8 bg-background rounded w-1/4 mb-4 sm:mb-6 animate-pulse"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {[...Array(6)].map((_, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-lg border border-border animate-pulse min-h-[100px]"
                        >
                            <div className="w-12 h-12 rounded-lg bg-background flex-shrink-0"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-5 bg-background rounded w-2/3"></div>
                                <div className="h-3 bg-background rounded w-1/2"></div>
                            </div>
                            <div className="w-5 h-5 rounded bg-background flex-shrink-0"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DashboardSkeleton;
