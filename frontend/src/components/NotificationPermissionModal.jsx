import React from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationPermissionModal = ({ isOpen, onClose, onAllow }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 text-muted-text hover:text-sub rounded-full hover:bg-background transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-[var(--primary-light)] rounded-full flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-primary" />
                        </div>

                        <h3 className="text-xl font-bold text-main mb-2">
                            Don't Miss Important Updates!
                        </h3>

                        <p className="text-sub mb-6 leading-relaxed">
                            Turn on notifications to get instant updates about:
                            <br />
                            <span className="font-semibold text-sub">• Attendance Reports</span>
                            <br />
                            <span className="font-semibold text-sub">• Campus Events</span>
                            <br />
                            <span className="font-semibold text-sub">• Service Requests</span>
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={onAllow}
                                className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-lg shadow-primary transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Turn On Notifications
                            </button>

                            <button
                                onClick={onClose}
                                className="w-full py-3 px-4 bg-background hover:bg-background text-sub font-medium rounded-xl transition-colors"
                            >
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default NotificationPermissionModal;
