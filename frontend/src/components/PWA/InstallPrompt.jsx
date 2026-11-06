import React, { useState, useEffect } from 'react';
import { RiDownloadCloud2Fill, RiCloseLine } from 'react-icons/ri';
import { AnimatePresence, motion } from 'framer-motion';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Check if user has already dismissed or installed in this session (optional, using simple state for now)
            // Ideally check local storage to not annoy user
            const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
            if (!hasDismissed) {
                setTimeout(() => setShowPrompt(true), 3000); // Delay showing prompt
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity pointer-events-auto" onClick={handleDismiss} />

            {/* Bottom Sheet */}
            <div className="bg-surface w-full max-w-md m-4 mb-safe rounded-3xl p-6 shadow-2xl transform transition-transform pointer-events-auto animate-slide-up relative">
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 p-2 bg-background rounded-full text-muted-text hover:text-sub"
                >
                    <RiCloseLine size={24} />
                </button>

                <div className="flex gap-5 items-start">
                    <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary shrink-0">
                        <RiDownloadCloud2Fill size={28} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-main leading-tight mb-1">Install Student Portal</h3>
                        <p className="text-sm text-muted-text leading-relaxed mb-4">
                            Get the best experience with faster loading and offline access.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 mt-2">
                    <button
                        onClick={handleDismiss}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-sub bg-background hover:bg-background transition-colors"
                    >
                        Not Now
                    </button>
                    <button
                        onClick={handleInstallClick}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-lg shadow-primary transition-all active:scale-95"
                    >
                        Install App
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
