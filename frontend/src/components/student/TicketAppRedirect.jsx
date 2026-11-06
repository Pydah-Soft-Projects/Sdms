import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const TicketAppRedirect = ({ redirectPath }) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user?.role === 'student') {
      navigate('/student/my-tickets', { replace: true });
    } else {
      navigate(redirectPath || '/task-management', { replace: true });
    }
  }, [user, redirectPath, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
      <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-semibold text-gray-700">Loading Maintenance portal...</p>
    </div>
  );
};

export default TicketAppRedirect;
