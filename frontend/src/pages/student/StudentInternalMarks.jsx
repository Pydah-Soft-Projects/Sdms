import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { Award, ArrowLeft, Loader2, BarChart2, CheckCircle, AlertCircle } from 'lucide-react';

const StudentInternalMarks = () => {
  const navigate = useNavigate();
  const [marksData, setMarksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSem, setSelectedSem] = useState('all');

  useEffect(() => {
    const fetchMarks = async () => {
      try {
        const res = await api.get('/internal-marks/student/me');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setMarksData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load internal marks:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMarks();
  }, []);

  const semesters = useMemo(() => {
    const set = new Set();
    marksData.forEach((item) => {
      if (item.semester) set.add(String(item.semester));
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [marksData]);

  const filteredMarks = useMemo(() => {
    if (selectedSem === 'all') return marksData;
    return marksData.filter((item) => String(item.semester) === selectedSem);
  }, [marksData, selectedSem]);

  // Group by Subject
  const groupedBySubject = useMemo(() => {
    const groups = {};
    filteredMarks.forEach((m) => {
      const sub = m.subject_name || 'General Subject';
      if (!groups[sub]) groups[sub] = [];
      groups[sub].push(m);
    });
    return groups;
  }, [filteredMarks]);

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Award className="text-sky-600 w-5 h-5" />
              Internal Marks & Results
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Review your mid-term, assignment, and internal evaluation marks.
            </p>
          </div>
        </div>

        {/* Semester Filter */}
        {semesters.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedSem('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedSem === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Semesters
            </button>
            {semesters.map((sem) => (
              <button
                key={sem}
                onClick={() => setSelectedSem(sem)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedSem === sem
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Semester {sem}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Marks Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading internal marks...</p>
        </div>
      ) : Object.keys(groupedBySubject).length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 text-center">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
            <BarChart2 size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No marks posted yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Internal evaluation scores and exam results will appear here as soon as they are published by your faculty.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedBySubject).map(([subject, marksList]) => (
            <div key={subject} className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">{subject}</h3>
                <span className="text-xs font-semibold text-slate-400">{marksList.length} Evaluation{marksList.length > 1 ? 's' : ''}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {marksList.map((m, idx) => {
                  const pct = m.max_marks ? Math.round((Number(m.marks) / Number(m.max_marks)) * 100) : null;
                  const isGood = pct != null && pct >= 60;
                  return (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">
                        {m.marks_type}
                      </span>
                      <div className="my-1.5 flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-900">{m.marks}</span>
                        {m.max_marks && (
                          <span className="text-xs text-slate-400 font-semibold">/ {m.max_marks}</span>
                        )}
                      </div>
                      {pct != null && (
                        <div className="flex items-center gap-1 text-[10px] font-bold">
                          {isGood ? (
                            <span className="text-emerald-600 flex items-center gap-0.5">
                              <CheckCircle size={10} /> {pct}%
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-0.5">
                              <AlertCircle size={10} /> {pct}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentInternalMarks;
