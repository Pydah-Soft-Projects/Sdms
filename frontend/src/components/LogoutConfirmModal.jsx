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
        className="absolute inset-0 bg-[var(--sidebar)]/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={() => {
          if (!isLoggingOut) onClose();
        }}
      />

      {/* Modal Card */}
      <div
        className="relative z-10 mx-auto w-full max-w-[390px] sm:max-w-md overflow-hidden rounded-2xl border border-border bg-surface p-6 sm:p-7 shadow-2xl transition-all dark:border-border-strong dark:bg-sidebar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-text transition hover:bg-background hover:text-sub focus:outline-none focus:ring-2 focus:ring-border-strong disabled:opacity-50 dark:hover:bg-sidebar dark:hover:text-muted-text"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content Container (Center Aligned) */}
        <div className="flex flex-col items-center text-center">
          {/* Visual Icon Badge */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-light)] ring-8 ring-[var(--danger-light)] dark:bg-[var(--danger-light)] dark:ring-[var(--danger-light)]">
            <LogOut className="h-6 w-6 text-danger dark:text-danger" />
          </div>

          {/* Title */}
          <h3
            id="logout-modal-title"
            className="text-lg sm:text-xl font-bold text-main dark:text-muted-text tracking-tight"
          >
            Confirm Sign Out
          </h3>

          {/* Description & SSO Context */}
          <div className="mt-2.5 w-full text-sm text-sub dark:text-muted-text">
            {isSSO ? (
              <div className="space-y-3">
                <p className="leading-relaxed">
                  Are you sure you want to sign out?
                </p>
                <div className="rounded-xl border border-[var(--warning-light)] bg-gradient-to-br from-[var(--warning-light)] to-[var(--warning-light)] p-3 text-center dark:border-warning dark:from-[var(--warning-light)] dark:to-[var(--warning-light)] shadow-sm">
                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-warning dark:text-warning">
                    <ExternalLink className="h-3.5 w-3.5 text-warning dark:text-warning flex-shrink-0" />
                    <span>It will redirect to the CRM portal</span>
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
              className="flex-1 cursor-pointer rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-sub shadow-sm transition hover:bg-background active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-border-strong disabled:opacity-50 dark:border-border-strong dark:bg-sidebar dark:text-muted-text dark:hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleConfirm}
              className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-danger to-danger px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-danger/20 transition hover:from-danger hover:to-danger active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-danger disabled:opacity-50"
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
