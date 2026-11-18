import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import useAuthStore from '../../store/authStore';
import { SkeletonBox } from '../../components/SkeletonLoader';
import DigitalStudentCard from '../../components/DigitalStudentCard';
import DigitalIdCardBack from '../../components/DigitalIdCardBack';
import { printIdCardFrontAndBack } from '../../utils/printDigitalIdCard';
import { ArrowLeft, CreditCard, Printer, RotateCw, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

const StudentIdCard = () => {
  const { user, userType } = useAuthStore();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);

  // Enforce strict student role visibility
  const userRole = String(user?.role || userType || '').toLowerCase();
  const isStudent = (userRole === 'student' || userType === 'student') &&
    !['staff', 'faculty', 'admin', 'super_admin', 'superadmin', 'employee', 'principal'].includes(userRole);
  const [backOrientation, setBackOrientation] = useState(() => {
    try {
      return localStorage.getItem('id_card_back_orientation') || 'straight';
    } catch {
      return 'straight';
    }
  });

  useEffect(() => {
    const load = async () => {
      try {
        if (user?.admission_number) {
          const res = await api.get(`/students/${user.admission_number}`);
          if (res.data?.success) {
            setStudentData(res.data.data);
          }
        }
      } catch (e) {
        console.error('Failed to load student profile for ID card', e);
        toast.error('Failed to load ID card details');
      } finally {
        setLoading(false);
      }
    };

    const loadColleges = async () => {
      try {
        const res = await api.get('/colleges');
        if (res.data?.success) {
          setColleges(res.data.data || []);
        }
      } catch (e) {
        console.error('Failed to load colleges', e);
      }
    };

    load();
    loadColleges();
  }, [user]);

  const displayData = studentData || user;

  const getSd = useCallback((key, fallback = '') => {
    if (!displayData) return fallback;
    if (displayData[key] !== undefined && displayData[key] !== null && String(displayData[key]).trim() !== '') {
      return String(displayData[key]);
    }
    const sd = displayData.student_data || {};
    if (sd[key] !== undefined && sd[key] !== null && String(sd[key]).trim() !== '') {
      return String(sd[key]);
    }
    const foundKey = Object.keys(sd).find(k => k.toLowerCase() === String(key).toLowerCase());
    if (foundKey && sd[foundKey] !== undefined && sd[foundKey] !== null && String(sd[foundKey]).trim() !== '') {
      return String(sd[foundKey]);
    }
    return fallback;
  }, [displayData]);

  const activeCollege = colleges.find(c => {
    const cName = String(c.name || c.college_name || '').trim().toLowerCase();
    const studCol = String(displayData?.college || getSd('College') || '').trim().toLowerCase();
    return cName && studCol && (cName === studCol || studCol.includes(cName) || cName.includes(studCol));
  }) || displayData?.college || getSd('College');

  const principalSignatureUrl = activeCollege?.principal_signature || activeCollege?.signature_url || null;

  const handlePrint = () => {
    try {
      printIdCardFrontAndBack('.id-card-print-front', '.id-card-print-back', {
        backOrientation,
      });
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

  const handleToggleOrientation = () => {
    const next = backOrientation === 'straight' ? 'rotate180' : 'straight';
    setBackOrientation(next);
    try {
      localStorage.setItem('id_card_back_orientation', next);
    } catch {}
  };

  if (!isStudent) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <ShieldCheck size={48} className="text-muted-text mb-3" />
        <p className="text-base font-bold text-main">Access Restricted</p>
        <p className="text-xs text-muted-text mt-1 max-w-sm">
          Digital ID Cards are accessible only to students. Staff, faculty, and administrators cannot access this view.
        </p>
        <button
          onClick={() => navigate('/student/profile')}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors"
        >
          Return to Profile
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full min-h-full flex items-start justify-center p-4 sm:p-8">
        <SkeletonBox className="h-[520px] w-full max-w-[420px] rounded-3xl" />
      </div>
    );
  }

  if (!displayData) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <CreditCard size={48} className="text-muted-text mb-3" />
        <p className="text-base font-bold text-main">Unable to load Digital ID Card</p>
        <p className="text-xs text-muted-text mt-1 max-w-sm">
          Please check your connection or return to your account profile.
        </p>
        <button
          onClick={() => navigate('/student/profile')}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors"
        >
          Back to Profile
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-h-full flex flex-col p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/student/profile')}
            aria-label="Back to account settings"
            className="p-2 rounded-xl text-sub hover:text-main hover:bg-surface border border-border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-main tracking-tight">Digital ID Card</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck size={12} /> Official
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-text mt-0.5">
              Standard CR80 (54 × 85.6 mm) student identity document
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleToggleOrientation}
            aria-label="Toggle Back Side Flip Orientation"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface hover:bg-background border border-border text-sub text-xs font-bold transition-all min-h-[44px]"
          >
            <RotateCw size={14} />
            <span className="hidden sm:inline">Flip:</span>
            <span>{backOrientation === 'straight' ? 'Straight (0°)' : 'Rotated (180°)'}</span>
          </button>
        </div>
      </div>

      {/* Cards Display (Side-by-side on wide screens, stacked on small) */}
      <div className="flex-1 w-full flex flex-col lg:flex-row items-center justify-center gap-8 pb-10">
        <div className="w-full max-w-[360px] flex flex-col items-center">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted-text mb-2.5">Front Side</p>
          <div className="id-card-preview-scaler-box">
            <div className="id-card-preview-scaler">
              <DigitalStudentCard
                className="id-card-print-front"
                student={displayData}
                getStudentData={getSd}
                college={activeCollege}
                principalSignatureUrl={principalSignatureUrl}
                showWatermark={true}
              />
            </div>
          </div>
        </div>

        <div className="w-full max-w-[360px] flex flex-col items-center">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted-text mb-2.5">Back Side</p>
          <div className="id-card-preview-scaler-box">
            <div className="id-card-preview-scaler">
              <DigitalIdCardBack
                className="id-card-print-back"
                student={displayData}
                getStudentData={getSd}
                college={activeCollege}
                rotate180={backOrientation === 'rotate180'}
                showWatermark={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentIdCard;

