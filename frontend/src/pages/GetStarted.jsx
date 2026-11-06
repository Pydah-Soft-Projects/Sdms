import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle,
  LogIn,
  Building2,
  Sparkles,
  ShieldCheck,
  Users,
  GraduationCap,
  CalendarCheck,
  FileText,
  BadgeCheck
} from 'lucide-react';

const GetStarted = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col bg-[#FAFAF5] text-[#1A2517] font-sans selection:bg-[#A3B18A]/30">
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-[100] bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
          Offline Mode
        </div>
      )}

      {/* Top Navbar */}
      <header className="shrink-0 h-16 sm:h-20 border-b border-[#E8E6DF] bg-[#FAFAF5]/90 backdrop-blur-md px-4 sm:px-8 lg:px-12 flex items-center justify-between z-20">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#1A2517] text-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg sm:text-xl font-black text-[#1A2517] tracking-wider leading-none">
              CAMPO STUDENTS
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-[#4A5D3F] uppercase tracking-[0.2em] mt-1">
              Student Management Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#1A2517] hover:bg-[#1A2517]/5 transition-all"
          >
            <LogIn size={16} /> Sign In
          </button>
          <button
            onClick={() => navigate('/login')}
            className="px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#1A2517] hover:bg-[#2B3C26] shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <span>Launch Portal</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* Hero Full Screen Section (Centered with zero image and zero scroll) */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 max-w-5xl mx-auto w-full py-4 overflow-hidden min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full flex flex-col items-center text-center space-y-4 sm:space-y-5"
        >
          {/* Pill Badge */}
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1A2517]/5 border border-[#1A2517]/10 text-[#2E5A36] text-[11px] sm:text-xs font-bold uppercase tracking-widest">
            <Sparkles size={14} className="text-[#2E5A36]" />
            Unified Campus Ecosystem
          </span>

          {/* Heading */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#1A2517] leading-[1.12] tracking-tight max-w-3xl">
            Track <span className="text-[#2E5A36]">Everything</span> About Your Student Life
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm md:text-base text-[#475569] leading-relaxed max-w-2xl">
            One centralized portal for attendance tracking, academic profiles, semester registrations, verified documents, timetables, fee status, and campus support services.
          </p>

          {/* Main Action Button */}
          <div className="pt-2">
            <button
              onClick={() => navigate('/login')}
              className="group px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base text-white bg-[#1A2517] hover:bg-[#2B3C26] shadow-xl flex items-center gap-3 active:scale-95 transition-all"
            >
              <span>Access Student Portal</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Portal Selector Cards */}
          <div className="w-full pt-4">
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-3">
              Direct Portal Access
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full">
              {/* Admin Portal Card */}
              <button
                onClick={() => navigate('/login')}
                className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#1A2517] hover:shadow-md text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-xl bg-[#1A2517]/5 flex items-center justify-center text-[#1A2517] mb-2.5 group-hover:scale-110 transition-transform">
                    <Building2 size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1A2517] leading-tight">Admin &amp; Staff</h3>
                  <p className="text-[11px] text-[#64748B] mt-1 leading-normal">
                    Management, attendance monitoring, announcements &amp; reports
                  </p>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-bold text-[#1A2517] group-hover:translate-x-1 transition-transform">
                  <span>Sign In</span>
                  <ArrowRight size={13} className="ml-1" />
                </div>
              </button>

              {/* Student Portal Card */}
              <button
                onClick={() => navigate('/student/login')}
                className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#2E5A36] hover:shadow-md text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-xl bg-[#2E5A36]/10 flex items-center justify-center text-[#2E5A36] mb-2.5 group-hover:scale-110 transition-transform">
                    <GraduationCap size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1A2517] leading-tight">Student Portal</h3>
                  <p className="text-[11px] text-[#64748B] mt-1 leading-normal">
                    Attendance, registration, timetable, fees &amp; digital ID card
                  </p>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-bold text-[#2E5A36] group-hover:translate-x-1 transition-transform">
                  <span>Sign In</span>
                  <ArrowRight size={13} className="ml-1" />
                </div>
              </button>

              {/* Parent Portal Card */}
              <button
                onClick={() => navigate('/parent/login')}
                className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#4A5D3F] hover:shadow-md text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-xl bg-[#4A5D3F]/10 flex items-center justify-center text-[#4A5D3F] mb-2.5 group-hover:scale-110 transition-transform">
                    <Users size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1A2517] leading-tight">Parent Portal</h3>
                  <p className="text-[11px] text-[#64748B] mt-1 leading-normal">
                    Real-time attendance alerts, verified records &amp; fee status
                  </p>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-bold text-[#4A5D3F] group-hover:translate-x-1 transition-transform">
                  <span>Sign In</span>
                  <ArrowRight size={13} className="ml-1" />
                </div>
              </button>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[11px] text-[#64748B]">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-[#2E5A36]" />
              <span>Verified Digital Records</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarCheck size={14} className="text-[#2E5A36]" />
              <span>Daily Attendance Tracking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#2E5A36]" />
              <span>Secure Authentication</span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Bottom Compact Footer Bar */}
      <footer className="shrink-0 h-10 sm:h-12 border-t border-[#E8E6DF] bg-[#FAFAF5] px-4 sm:px-8 lg:px-12 flex items-center justify-between text-[11px] text-[#64748B] z-10">
        <div>
          <span>&copy; {new Date().getFullYear()} CAMPOSDMS. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium">
          <button onClick={() => navigate('/login')} className="hover:text-[#1A2517] transition-colors">Admin Portal</button>
          <span>&bull;</span>
          <button onClick={() => navigate('/student/login')} className="hover:text-[#1A2517] transition-colors">Student Portal</button>
          <span>&bull;</span>
          <button onClick={() => navigate('/parent/login')} className="hover:text-[#1A2517] transition-colors">Parent Portal</button>
        </div>
      </footer>
    </div>
  );
};

export default GetStarted;
