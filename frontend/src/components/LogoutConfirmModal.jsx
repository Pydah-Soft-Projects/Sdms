import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, ExternalLink, X } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { CRM_FRONTEND_URL } from '../config/api';

/**
 * Logout confirmation modal with SSO-aware messaging and redirection.
 * Center-aligned, mobile-responsive, and accessible.
 */
const LogoutConfirmModal = ({ isOpen, onClose, onConfirm }) => {
  const [mounted, setMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { user, logout, isSSO: getIsSSO, getCRMUrl } = useAuthStore();

  const isSSO = typeof getIsSSO === 'function' 
    ? getIsSSO() 
    : Boolean(localStorage.getItem('isSSO') === 'true' || user?.isSSO);

  const crmUrl = typeof getCRMUrl === 'function'
    ? getCRMUrl()
    : (localStorage.getItem('crmUrl') || CRM_FRONTEND_URL || 'https://crm.pydah.edu.in');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsLoggingOut(false);
    }
  }, [isOpen]);

  // Keyboard navigation & body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoggingOut) {
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoggingOut, onClose]);

  if (!isOpen || !mounted) return null;

  const handleConfirm = async () => {
    setIsLoggingOut(true);
    try {
      if (onConfirm) {
        await onConfirm();
      } else {
        logout();
      }
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoggingOut(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={() => {
          if (!isLoggingOut) onClose();
        }}
      />

      {/* Modal Card */}
      <div
        className="relative z-10 mx-auto w-full max-w-[390px] sm:max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content Container (Center Aligned) */}
        <div className="flex flex-col items-center text-center">
          {/* Visual Icon Badge */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 ring-8 ring-rose-50/60 dark:bg-rose-950/40 dark:ring-rose-950/30">
            <LogOut className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>

          {/* Title */}
          <h3
            id="logout-modal-title"
            className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight"
          >
            Confirm Sign Out
          </h3>

          {/* Description & SSO Context */}
          <div className="mt-2.5 w-full text-sm text-slate-600 dark:text-slate-300">
            {isSSO ? (
              <div className="space-y-3">
                <p className="leading-relaxed">
                  Are you sure you want to sign out of the Student Portal?
                </p>
                <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/60 p-3.5 text-left dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/20 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <ExternalLink className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        Single Sign-On (SSO) Active
                      </p>
                      <p className="text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                        You logged in via Single Sign-On. Signing out will end your session and redirect you back to the{' '}
                        <strong className="font-semibold text-amber-900 dark:text-amber-100">CRM Portal</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="leading-relaxed">
                Are you sure you want to sign out? You will need to enter your credentials to log back in.
              </p>
            )}
          </div>

          {/* Buttons: Center-Aligned and Responsive */}
          <div className="mt-6 flex w-full max-w-xs flex-row items-center justify-center gap-3">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={onClose}
              className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleConfirm}
              className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-600/20 transition hover:from-red-700 hover:to-rose-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              {isLoggingOut ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-white flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="truncate">{isSSO ? 'Redirecting...' : 'Signing out...'}</span>
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 flex-shrink-0" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default LogoutConfirmModal;
