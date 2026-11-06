import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RegistrationPendingModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleGoToRegistration = () => {
        onClose();
        navigate('/student/semester-registration');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in relative text-center">
                <div className="bg-[var(--warning-light)] p-6 border-b border-[var(--warning-light)]">
                    <div className="w-16 h-16 bg-[var(--warning-light)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-warning" />
                    </div>
                    <h3 className="text-xl font-bold text-main">Registration Pending</h3>
                </div>

                <div className="p-6">
                    <p className="text-sub mb-6 leading-relaxed">
                        Access to this section is restricted. You must complete your semester registration to access the full student portal features.
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleGoToRegistration}
                            className="w-full py-3 bg-warning text-white rounded-xl font-bold hover:bg-warning transition-colors flex items-center justify-center gap-2 shadow-lg shadow-warning"
                        >
                            Complete Registration <ArrowRight size={18} />
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-background text-sub rounded-xl font-semibold hover:bg-background transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistrationPendingModal;
