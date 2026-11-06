import React from 'react';
import { Plus } from 'lucide-react';

const TimetableTable = ({
    periodSlots,
    timetableData,
    onEditSlot,
    loading = false
}) => {
    const days = ['MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-10 h-10 border-4 border-border-strong border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-muted-text uppercase tracking-widest">Loading Grid...</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-surface shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full border-2 border-border-strong border-collapse table-fixed">
                    <thead>
                        <tr className="bg-[var(--background)]/50">
                            <th className="border-2 border-border-strong p-2 text-[12px] font-black text-main bg-background w-20">
                                S.NO
                            </th>
                            {periodSlots.map((slot) => (
                                <th key={slot.id} className="border-2 border-border-strong p-1 bg-background min-w-[100px]">
                                    <div className="text-[10px] font-bold text-main mb-0.5 tracking-tight">{slot.start_time.substring(0, 5)}-{slot.end_time.substring(0, 5)}</div>
                                    <div className="text-[9px] font-black text-muted-text uppercase tracking-tighter opacity-70 leading-none">{slot.name}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {days.map((day) => (
                            <tr key={day} className="h-20">
                                <td className="border-2 border-border-strong bg-background p-1 text-center font-black text-[13px] text-main">
                                    {day}
                                </td>
                                {(() => {
                                    let skipCount = 0;
                                    return periodSlots.map((slot) => {
                                        if (skipCount > 0) {
                                            skipCount--;
                                            return null;
                                        }

                                        const entry = timetableData.find(e => e.day_of_week === day && e.period_slot_id === slot.id);
                                        const span = entry?.span || 1;
                                        if (span > 1) skipCount = span - 1;

                                        return (
                                            <td
                                                key={slot.id}
                                                colSpan={span}
                                                className={`border-2 border-border-strong p-1 group relative transition-all ${entry?.type === 'break'
                                                        ? 'bg-[var(--background)]/80 grayscale'
                                                        : entry ? 'bg-surface hover:bg-background' : 'bg-[var(--background)]/20'
                                                    }`}
                                                onClick={() => onEditSlot(day, slot.id, entry)}
                                            >
                                                {entry ? (
                                                    <div className="flex flex-col items-center justify-center text-center h-full cursor-pointer px-1">
                                                        {entry.type === 'subject' || entry.type === 'lab' ? (
                                                            <>
                                                                <div className={`text-[13px] font-black leading-none uppercase tracking-tight ${entry.type === 'lab' ? 'text-secondary' : 'text-main'
                                                                    }`}>
                                                                    {entry.subject_code || (entry.type === 'lab' ? 'LAB' : 'SUB')}
                                                                </div>
                                                                {entry.span === 1 ? (
                                                                    <div className="text-[8px] font-bold text-muted-text mt-1 uppercase line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        {entry.subject_name}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[9px] font-black text-muted-text mt-1 uppercase opacity-80 line-clamp-2 leading-tight">
                                                                        {entry.subject_name}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <span className="text-[11px] font-black text-muted-text tracking-[0.3em] uppercase">
                                                                    {entry.custom_label || 'LUNCH'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                                                        <Plus className="w-4 h-4 text-muted-text" />
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    });
                                })()}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-background border-t border-border flex justify-between items-center text-[10px] font-black text-muted-text uppercase tracking-widest">
                <span>Click any cell to manage slot</span>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-surface border border-border-strong"></div> Regular</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[var(--primary-light)] border border-[var(--primary-light)]"></div> Laboratory</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-background border border-border-strong"></div> Break/Activity</div>
                </div>
            </div>
        </div>
    );
};

export default TimetableTable;
