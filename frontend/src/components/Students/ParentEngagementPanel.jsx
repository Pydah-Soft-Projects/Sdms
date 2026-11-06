import React, { useEffect, useState } from 'react';
import { Eye, LogIn, Phone, CheckCircle, XCircle } from 'lucide-react';
import api from '../../config/api';

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const ParentEngagementPanel = ({ studentId, variant = 'inline' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isTab = variant === 'tab';

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/parent/engagement/${studentId}`);
        if (res.data.success) setData(res.data.data);
      } catch (err) {
        console.error('Parent engagement fetch failed', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [studentId]);

  if (loading) {
    return (
      <div className={`${isTab ? 'min-h-[200px]' : 'mt-4'} p-4 rounded-xl border border-border bg-background animate-pulse h-32`} />
    );
  }

  if (!data) {
    if (!isTab) return null;
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-text bg-surface rounded-2xl border border-border">
        <Eye size={40} className="text-muted-text mb-3" />
        <p className="font-semibold text-sub">No parent portal activity yet</p>
        <p className="text-sm mt-1 max-w-sm">
          Views and logins will appear here after a parent signs in via the Parent Portal.
        </p>
      </div>
    );
  }

  const content = (
    <>
      <h4 className={`${isTab ? 'text-base' : 'text-sm'} font-black text-primary uppercase tracking-wider mb-4 flex items-center gap-2`}>
        <Eye size={isTab ? 20 : 16} /> Parent Portal Activity
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Profile views" value={data.profile_view_count || 0} />
        <Stat label="Attendance views" value={data.attendance_view_count || 0} />
        <Stat label="Total views" value={data.total_views || 0} />
        <Stat label="Last login" value={formatDate(data.last_login_at)} small />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-sub">
        <span className="flex items-center gap-1">
          {data.is_parent_mobile_verified ? (
            <CheckCircle size={14} className="text-success" />
          ) : (
            <XCircle size={14} className="text-warning" />
          )}
          Parent mobile {data.is_parent_mobile_verified ? 'verified' : 'not verified'}
        </span>
        {data.last_parent_mobile && (
          <span className="flex items-center gap-1">
            <Phone size={14} /> Last parent: {data.last_parent_mobile}
          </span>
        )}
        <span className="flex items-center gap-1">
          <LogIn size={14} /> Last viewed: {formatDate(data.last_viewed_at)}
        </span>
        {(data.parent_mobile1 || data.parent_mobile2) && (
          <span className="flex items-center gap-1 w-full sm:w-auto">
            <Phone size={14} /> Registered: {[data.parent_mobile1, data.parent_mobile2].filter(Boolean).join(' / ')}
          </span>
        )}
      </div>
    </>
  );

  if (isTab) {
    return (
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
        {content}
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 rounded-2xl border border-[var(--primary-light)] bg-[var(--primary-light)]">
      {content}
    </div>
  );
};

const Stat = ({ label, value, small }) => (
  <div className="bg-surface rounded-xl p-3 border border-border shadow-sm">
    <p className="text-[10px] font-bold text-muted-text uppercase">{label}</p>
    <p className={`font-black text-primary mt-1 ${small ? 'text-xs' : 'text-lg'}`}>{value}</p>
  </div>
);

export default ParentEngagementPanel;
