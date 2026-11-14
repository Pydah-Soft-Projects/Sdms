import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { SkeletonBox } from '../../components/SkeletonLoader';
import DigitalStudentCard from '../../components/DigitalStudentCard';
import DigitalIdCardBack from '../../components/DigitalIdCardBack';
import { buildParentDisplayData } from '../../utils/parentProfileHelpers';
import { toast } from 'react-hot-toast';

const ParentIdCard = () => {
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/parent/profile');
        if (res.data.success) {
          setStudentData(buildParentDisplayData(res.data.data));
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load ID card');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="w-full min-h-full flex items-start justify-center px-3 sm:px-0">
        <SkeletonBox className="h-[420px] w-full max-w-[380px] rounded-none sm:rounded-2xl" />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="w-full min-h-full flex items-center justify-center px-4">
        <p className="text-center text-muted-text">Unable to load student ID card.</p>
      </div>
    );
  }

  const getSd = (key, fallback = '') => {
    if (studentData && studentData[key] !== undefined && studentData[key] !== null && String(studentData[key]).trim() !== '') {
      return String(studentData[key]);
    }
    const sd = studentData?.student_data || {};
    const val = sd[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
    return fallback;
  };

  return (
    <div className="w-full max-w-7xl mx-auto min-h-full flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="w-full pb-3 border-b border-border">
        <h1 className="text-xl sm:text-2xl font-black text-main tracking-tight">Digital ID Card</h1>
        <p className="text-xs sm:text-sm text-muted-text mt-1">Official student identification card (view only)</p>
      </div>
      <div className="flex-1 w-full flex flex-col items-center gap-6 pb-6">
        <div className="w-full">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-text mb-2 text-center">Front Side</p>
          <div className="id-card-preview-scaler-box">
            <div className="id-card-preview-scaler">
              <DigitalStudentCard
                student={studentData}
                getStudentData={getSd}
              />
            </div>
          </div>
        </div>

        <div className="w-full">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-text mb-2 text-center">Back Side</p>
          <div className="id-card-preview-scaler-box">
            <div className="id-card-preview-scaler">
              <DigitalIdCardBack
                student={studentData}
                getStudentData={getSd}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentIdCard;
