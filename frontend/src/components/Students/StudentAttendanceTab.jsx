import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    Clock,
    AlertTriangle,
    Loader2
} from 'lucide-react';
import api from '../../config/api';
import LoadingAnimation from '../LoadingAnimation';
import toast from 'react-hot-toast';

const StudentAttendanceTab = ({ student }) => {
    const [historyData, setHistoryData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (student?.id) {
            fetchHistory();
        }
    }, [student]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/attendance/student/${student.id}/history`);
            if (response.data.success) {
                setHistoryData(response.data.data);
            } else {
                toast.error(response.data.message || 'Failed to load attendance history');
            }
        } catch (error) {
            console.error('Attendance fetch error:', error);
            toast.error('Failed to load attendance history');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadReport = async () => {
        if (!student) return;
        setDownloading(true);
        try {
            // Assume the endpoint generates a PDF or similar
            const response = await api.get(`/attendance/student/${student.id}/history`, {
                params: { download: true },
                responseType: 'blob'
            });

            // If the endpoint actually returns the file
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${student.studentName || 'student'}_attendance_report.pdf`); // Adjust extension as needed
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            // Fallback if the endpoint is different or just for viewing
            toast.error("Download feature not fully implemented in this view.");
        } finally {
            setDownloading(false);
        }
    };



    if (loading) {
        return (
            <div className="py-20 flex justify-center">
                <LoadingAnimation message="Fetching attendance history..." />
            </div>
        );
    }

    if (!historyData) {
        return (
            <div className="py-20 flex flex-col items-center gap-3 text-muted-text">
                <AlertTriangle size={28} />
                <p>Unable to load attendance history or no data available.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                {/* Download Button Placeholder - logic needed depends on backend implementation */}
            </div>

            {/* Semester Summary */}
            {historyData.semester && (
                <section>
                    <div className="bg-surface border border-[var(--primary-light)] rounded-2xl shadow-sm p-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-primary uppercase">Semester Attendance</p>
                                <p className="text-lg font-bold text-main">
                                    {historyData.semester?.startDate} → {historyData.semester?.endDate}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-text">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                        <Calendar size={12} /> {historyData.semester?.workingDays ?? 0} working days
                                    </span>
                                    {historyData.semester?.lastUpdated && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background text-sub border border-border">
                                            <Clock size={12} /> Updated {new Date(historyData.semester.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                {(() => {
                                    const semesterTotals = historyData.semester?.totals || {};
                                    const markedDays =
                                        (semesterTotals.present || 0) +
                                        (semesterTotals.absent || 0);
                                    const presentDays = semesterTotals.present || 0;
                                    const percentage = markedDays > 0 ? ((presentDays / markedDays) * 100).toFixed(1) : '0.0';
                                    return (
                                        <div className="inline-flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--primary-light)] border border-[var(--primary-light)]">
                                            <div className="text-left">
                                                <p className="text-xs text-sub">Attendance %</p>
                                                <p className="text-2xl font-bold text-primary">{percentage}%</p>
                                            </div>
                                            <div className="text-xs text-muted-text">
                                                <p><span className="font-semibold text-success">{semesterTotals.present ?? 0}</span> present</p>
                                                <p><span className="font-semibold text-danger">{semesterTotals.absent ?? 0}</span> absent</p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-3">
                            <div className="bg-[var(--success-light)] border border-[var(--success-light)] rounded-lg p-3">
                                <p className="text-xs text-sub">Present</p>
                                <p className="text-xl font-bold text-success">{historyData.semester?.totals?.present ?? 0}</p>
                            </div>
                            <div className="bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-lg p-3">
                                <p className="text-xs text-sub">Absent</p>
                                <p className="text-xl font-bold text-danger">{historyData.semester?.totals?.absent ?? 0}</p>
                            </div>
                            <div className="bg-background border border-border rounded-lg p-3">
                                <p className="text-xs text-sub">Unmarked</p>
                                <p className="text-xl font-bold text-sub">{historyData.semester?.totals?.unmarked ?? 0}</p>
                            </div>
                            <div className="bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-lg p-3">
                                <p className="text-xs text-sub">Holidays</p>
                                <p className="text-xl font-bold text-warning">{historyData.semester?.totals?.holidays ?? 0}</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-primary uppercase">Weekly Summary</h3>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                        <div>
                            <p className="text-xs text-muted-text">Present</p>
                            <p className="text-lg font-semibold text-success">{historyData.weekly?.totals?.present ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text">Absent</p>
                            <p className="text-lg font-semibold text-danger">{historyData.weekly?.totals?.absent ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text">Unmarked</p>
                            <p className="text-lg font-semibold text-sub">{historyData.weekly?.totals?.unmarked ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text">Holidays</p>
                            <p className="text-lg font-semibold text-warning">{historyData.weekly?.totals?.holidays ?? 0}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-text">Range: {historyData.weekly?.startDate} → {historyData.weekly?.endDate}</p>
                </div>

                <div className="bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-secondary uppercase">Monthly Summary</h3>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                        <div>
                            <p className="text-xs text-muted-text">Present</p>
                            <p className="text-lg font-semibold text-success">{historyData.monthly?.totals?.present ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text">Absent</p>
                            <p className="text-lg font-semibold text-danger">{historyData.monthly?.totals?.absent ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text">Unmarked</p>
                            <p className="text-lg font-semibold text-sub">{historyData.monthly?.totals?.unmarked ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text">Holidays</p>
                            <p className="text-lg font-semibold text-warning">{historyData.monthly?.totals?.holidays ?? 0}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-text">Range: {historyData.monthly?.startDate} → {historyData.monthly?.endDate}</p>
                </div>
            </section>



            {/* Monthly Breakdown - Show all months in semester */}
            {historyData.semester && historyData.semester.series && (() => {
                // Group attendance by month
                const monthlyData = {};
                historyData.semester.series.forEach((entry) => {
                    const date = new Date(entry.date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = {
                            monthName,
                            present: 0,
                            absent: 0,
                            unmarked: 0,
                            holidays: 0,
                            total: 0
                        };
                    }

                    if (entry.isHoliday) {
                        monthlyData[monthKey].holidays++;
                    } else if (entry.status === 'present') {
                        monthlyData[monthKey].present++;
                    } else if (entry.status === 'absent') {
                        monthlyData[monthKey].absent++;
                    } else {
                        monthlyData[monthKey].unmarked++;
                    }
                    monthlyData[monthKey].total++;
                });

                const months = Object.keys(monthlyData).sort().map(key => ({
                    key,
                    ...monthlyData[key]
                }));

                return (
                    <section>
                        <h3 className="text-sm font-semibold text-main mb-3">
                            Monthly Breakdown (Semester: {historyData.semester.startDate} → {historyData.semester.endDate})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {months.map((month) => {
                                const markedDays = month.present + month.absent;
                                const percentage = markedDays > 0
                                    ? ((month.present / markedDays) * 100).toFixed(1)
                                    : '0.0';

                                return (
                                    <div
                                        key={month.key}
                                        className="bg-surface border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
                                    >
                                        <h4 className="text-sm font-semibold text-main mb-3">{month.monthName}</h4>
                                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                            <div>
                                                <p className="text-xs text-muted-text">Present</p>
                                                <p className="text-base font-semibold text-success">{month.present}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-text">Absent</p>
                                                <p className="text-base font-semibold text-danger">{month.absent}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-text">Holidays</p>
                                                <p className="text-base font-semibold text-warning">{month.holidays}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-text">Unmarked</p>
                                                <p className="text-base font-semibold text-muted-text">{month.unmarked}</p>
                                            </div>
                                        </div>
                                        <div className="pt-3 border-t border-border flex items-center justify-between">
                                            <span className="text-xs text-muted-text">Attendance</span>
                                            <span className={`text-lg font-bold ${Number(percentage) >= 75 ? 'text-success' :
                                                Number(percentage) >= 65 ? 'text-warning' : 'text-danger'
                                                }`}>
                                                {percentage}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })()}
        </div>
    );
};

export default StudentAttendanceTab;
