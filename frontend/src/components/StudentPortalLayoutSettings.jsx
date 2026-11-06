import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    Save,
    Layout,
    Home,
    Megaphone,
    Users,
    Calendar,
    CheckCircle2,
    MapPin,
    Clock,
    FileText,
    Briefcase,
    Ticket,
    MessageSquare,
    Eye,
    EyeOff,
    Bus,
    Wallet,
    Award,
    Sparkles,
    BookMarked
} from 'lucide-react';
import api from '../config/api';

const StudentPortalLayoutSettings = ({ readOnly = false }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [layout, setLayout] = useState({
        dashboard: true,
        'ai-assistant': true,
        announcements: true,
        clubs: true,
        events: true,
        attendance: true,
        internship: true,
        timetable: true,
        'semester-registration': true,
        services: true,
        'my-tickets': true,
        feedback: true,
        transport: false,
        fees: false,
        scholarship: true,
        library: true
    });

    useEffect(() => {
        fetchLayoutSettings();
    }, []);

    const fetchLayoutSettings = async () => {
        try {
            setLoading(true);
            const response = await api.get('/settings/student-layout');
            if (response.data.success) {
                setLayout(response.data.data);
            }
        } catch (error) {
            console.error('Failed to load layout settings:', error);
            toast.error('Failed to load layout settings');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (key) => {
        setLayout(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const response = await api.put('/settings/student-layout', { layout });
            if (response.data.success) {
                toast.success('Student portal layout updated successfully');
            }
        } catch (error) {
            console.error('Failed to save layout settings:', error);
            toast.error('Failed to save layout settings');
        } finally {
            setSaving(false);
        }
    };

    const components = [
        { key: 'dashboard', label: 'Dashboard', icon: Home, description: 'Direct access to overview and quick stats' },
        { key: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, description: 'Interactive AI chat assistant and dedicated assistant page' },
        { key: 'announcements', label: 'Announcements', icon: Megaphone, description: 'Official college notices and news' },
        { key: 'clubs', label: 'Clubs', icon: Users, description: 'Student associations and activities' },
        { key: 'events', label: 'Event Calendar', icon: Calendar, description: 'Upcoming college events and schedule' },
        { key: 'attendance', label: 'Attendance', icon: CheckCircle2, description: 'Daily and hourly attendance records' },
        { key: 'internship', label: 'Internship', icon: MapPin, description: 'Internship assignments and tracking' },
        { key: 'timetable', label: 'Time Table', icon: Clock, description: 'Weekly academic class schedule' },
        { key: 'semester-registration', label: 'Sem Registration', icon: FileText, description: 'Semester enrollment and documentation' },
        { key: 'services', label: 'Services', icon: Briefcase, description: 'Certificate requests and student services' },
        { key: 'my-tickets', label: 'Maintenance', icon: Ticket, description: 'Raise and track maintenance tickets' },
        { key: 'library', label: 'Library', icon: BookMarked, description: 'Browse college library catalog, book search, and copy availability' },
        { key: 'feedback', label: 'Feed Back', icon: MessageSquare, description: 'Feedback forms for faculty and courses' },
        { key: 'transport', label: 'Transport', icon: Bus, description: 'College bus routes and tracking' },
        { key: 'fees', label: 'Fee Management', icon: Wallet, description: 'Fee payments and receipts' },
        { key: 'scholarship', label: 'Scholarship', icon: Award, description: 'Scholarship status and release history' },
    ];

    if (loading) {
        return (
            <div className="p-12 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-text text-sm">Loading layout settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                    <h2 className="text-lg font-bold text-main flex items-center gap-2">
                        <Layout size={20} className="text-primary" />
                        Student Portal Layout
                    </h2>
                    <p className="text-sm text-muted-text">Enable or disable components on the student sidebar</p>
                </div>
                {!readOnly && (
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-2 text-sm font-medium shadow-sm transition-all disabled:opacity-50"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {components.map((comp) => {
                    const Icon = comp.icon;
                    const isEnabled = layout[comp.key];

                    return (
                        <div
                            key={comp.key}
                            className={`p-4 rounded-xl border transition-all duration-300 ${isEnabled
                                ? 'bg-surface border-[var(--primary-light)] shadow-sm'
                                : 'bg-background border-border'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={`p-2 rounded-lg ${isEnabled ? 'bg-[var(--primary-light)] text-primary' : 'bg-background text-muted-text'
                                    }`}>
                                    <Icon size={18} />
                                </div>
                                <button
                                    onClick={() => handleToggle(comp.key)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isEnabled ? 'bg-primary' : 'bg-background'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-3 w-3 transform rounded-full bg-surface transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            <div>
                                <h3 className={`font-bold text-sm mb-1 ${isEnabled ? 'text-main' : 'text-muted-text'}`}>
                                    {comp.label}
                                </h3>
                                <p className="text-[11px] text-muted-text leading-tight h-8 overflow-hidden">
                                    {comp.description}
                                </p>
                            </div>

                            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isEnabled ? 'text-success' : 'text-muted-text'
                                    }`}>
                                    {isEnabled ? 'Visible' : 'Hidden'}
                                </span>
                                {isEnabled ? (
                                    <Eye size={14} className="text-success" />
                                ) : (
                                    <EyeOff size={14} className="text-muted-text" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-[var(--primary-light)] p-4 rounded-xl border border-[var(--primary-light)] flex gap-3">
                <div className="p-2 bg-[var(--primary-light)] rounded-lg text-primary h-fit">
                    <Layout size={18} />
                </div>
                <div>
                    <h4 className="font-bold text-primary text-xs">Portal Visibility Note</h4>
                    <p className="text-primary text-[11px] mt-0.5">
                        Changes here apply immediately across all student accounts. Disabling a component will hide its navigation link in the student portal sidebar.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StudentPortalLayoutSettings;
