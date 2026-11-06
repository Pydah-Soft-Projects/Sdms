/**
 * Faculty – Post Hourly Attendance (Pydah v2.0)
 */

import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { CalendarCheck, Loader2, Check, X, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const formatDate = (d) => (d instanceof Date ? d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : d);

export default function PostAttendance() {
  const [colleges, setColleges] = useState([]);
  const [periodSlots, setPeriodSlots] = useState([]);
  const [filters, setFilters] = useState({ batches: [], courses: [], branches: [] });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(formatDate(new Date()));
  const [collegeId, setCollegeId] = useState('');
  const [course, setCourse] = useState('');
  const [branch, setBranch] = useState('');
  const [batch, setBatch] = useState('');
  const [periodSlotId, setPeriodSlotId] = useState('');
  const [entries, setEntries] = useState({});

  useEffect(() => {
    api.get('/colleges').then((r) => {
      if (r.data.success && r.data.data?.length) setColleges(r.data.data);
    }).catch(() => { });
    api.get('/attendance/filters').then((r) => {
      if (r.data.success && r.data.data) {
        const d = r.data.data;
        setFilters({
          batches: [...new Set(d.batches || [])],
          courses: [...new Set(d.courses || [])],
          branches: [...new Set(d.branches || [])],
        });
      }
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!collegeId) {
      setPeriodSlots([]);
      setPeriodSlotId('');
      return;
    }
    api.get('/period-slots', { params: { college_id: collegeId } })
      .then((r) => {
        if (r.data.success) setPeriodSlots(r.data.data || []);
        else setPeriodSlots([]);
      })
      .catch(() => setPeriodSlots([]));
    setPeriodSlotId('');
  }, [collegeId]);

  const loadStudents = () => {
    if (!course && !branch) {
      toast.error('Select at least course or branch');
      return;
    }
    setLoading(true);
    const params = {};
    if (course) params.course = course;
    if (branch) params.branch = branch;
    if (batch) params.batch = batch;
    api.get('/hourly-attendance/students', { params })
      .then((r) => {
        if (r.data.success) {
          const list = r.data.data || [];
          setStudents(list);
          const init = {};
          list.forEach((s) => { init[s.student_id] = 'present'; });
          setEntries(init);
        } else setStudents([]);
      })
      .catch((e) => {
        toast.error(e.response?.data?.message || 'Failed to load students');
        setStudents([]);
      })
      .finally(() => setLoading(false));
  };

  const setStatus = (studentId, status) => {
    setEntries((prev) => ({ ...prev, [studentId]: status }));
  };

  const submit = () => {
    if (!date || !periodSlotId || students.length === 0) {
      toast.error('Select date, period, and load students');
      return;
    }
    const payload = {
      date,
      period_slot_id: Number(periodSlotId),
      course: course || undefined,
      branch: branch || undefined,
      batch: batch || undefined,
      entries: students.map((s) => ({ student_id: s.student_id, status: entries[s.student_id] || 'present' })),
    };
    setSubmitting(true);
    api.post('/hourly-attendance', payload)
      .then((r) => {
        if (r.data.success) toast.success(`Saved ${r.data.count ?? 0} attendance`);
        else toast.error(r.data.message || 'Failed');
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to save'))
      .finally(() => setSubmitting(false));
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-main mb-2">Post Hourly Attendance</h1>
      <p className="text-sub mb-6">Select date, period, and mark attendance for the class.</p>

      <div className="bg-surface rounded-xl border border-border p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border-strong px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">College</label>
            <select
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value)}
              className="w-full rounded-lg border border-border-strong px-3 py-2"
            >
              <option value="">Select</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Period</label>
            <select
              value={periodSlotId}
              onChange={(e) => setPeriodSlotId(e.target.value)}
              className="w-full rounded-lg border border-border-strong px-3 py-2"
            >
              <option value="">Select</option>
              {periodSlots.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.start_time}–{p.end_time})</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={loadStudents}
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Load Students
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Batch</label>
            <select value={batch} onChange={(e) => setBatch(e.target.value)} className="w-full rounded-lg border border-border-strong px-3 py-2">
              <option value="">All</option>
              {(filters.batches || []).map((b) => (
                <option key={b} value={b.id || b}>{b.name || b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Course</label>
            <select value={course} onChange={(e) => setCourse(e.target.value)} className="w-full rounded-lg border border-border-strong px-3 py-2">
              <option value="">Select</option>
              {(filters.courses || []).map((c) => (
                <option key={c} value={c.id || c}>{c.name || c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Branch</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full rounded-lg border border-border-strong px-3 py-2">
              <option value="">Select</option>
              {(filters.branches || []).map((b) => (
                <option key={b} value={b.id || b}>{b.name || b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {students.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-medium text-sub">{students.length} students</span>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
              Save Attendance
            </button>
          </div>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="min-w-full">
              <thead className="bg-background sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-text uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-text uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-text uppercase">Admission No</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-text uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s, i) => (
                  <tr key={s.student_id} className="hover:bg-background">
                    <td className="px-4 py-2 text-sub">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-main">{s.student_name}</td>
                    <td className="px-4 py-2 text-sub">{s.admission_number}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setStatus(s.student_id, 'present')}
                          className={`px-3 py-1 rounded-lg text-sm flex items-center gap-1 ${(entries[s.student_id] || 'present') === 'present' ? 'bg-success text-white' : 'bg-background text-sub'}`}
                        >
                          <Check className="w-4 h-4" /> Present
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(s.student_id, 'absent')}
                          className={`px-3 py-1 rounded-lg text-sm flex items-center gap-1 ${(entries[s.student_id] || 'present') === 'absent' ? 'bg-danger text-white' : 'bg-background text-sub'}`}
                        >
                          <X className="w-4 h-4" /> Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && students.length === 0 && (course || branch) && (
        <p className="text-muted-text text-center py-8">Click &quot;Load Students&quot; after selecting course/branch.</p>
      )}
    </div>
  );
}
