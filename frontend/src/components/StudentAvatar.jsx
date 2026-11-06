import React, { useState, useEffect } from 'react';
import { User, ImageOff } from 'lucide-react';
import api from '../config/api';

/**
 * A component that lazy-loads a student's photo by admission number.
 * Shows initials or a placeholder while loading or if no photo exists.
 */
const StudentAvatar = ({
    admissionNumber,
    studentName = '',
    className = "w-10 h-10",
    iconSize = 20,
    refreshTrigger = 0 // Key to force refresh
}) => {
    const [photoData, setPhotoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchPhoto = async () => {
            if (!admissionNumber) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const response = await api.get(`/students/${admissionNumber}/photo`);
                if (isMounted) {
                    if (response.data?.success && response.data?.data) {
                        setPhotoData(response.data.data);
                        setError(false);
                    } else {
                        setPhotoData(null);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setError(true);
                    // If 404, it means no photo, which is fine, just show placeholder
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchPhoto();

        return () => {
            isMounted = false;
        };
    }, [admissionNumber, refreshTrigger]);

    // Generate initials
    const initials = studentName
        ? studentName
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
        : '?';

    // Random bg color based on name
    const colors = [
        'bg-[var(--danger-light)] text-danger',
        'bg-[var(--success-light)] text-success',
        'bg-[var(--primary-light)] text-primary',
        'bg-[var(--warning-light)] text-warning',
        'bg-[var(--primary-light)] text-secondary',
        'bg-[var(--primary-light)] text-accent',
        'bg-[var(--primary-light)] text-primary',
        'bg-[var(--primary-light)] text-primary'
    ];

    const colorIndex = studentName ? studentName.length % colors.length : 0;
    const colorClass = colors[colorIndex];

    // If we have a photo, render it
    if (photoData && !error) {
        return (
            <img
                src={photoData}
                alt={studentName}
                className={`${className} rounded-full object-cover border border-border shadow-sm`}
                onError={() => setError(true)}
            />
        );
    }

    // Otherwise render initials or placeholder
    return (
        <div
            className={`${className} rounded-full flex items-center justify-center font-bold text-sm border border-border shadow-sm ${colorClass}`}
            title={studentName}
        >
            {error && !loading ? (
                initials
            ) : loading ? (
                <div className="animate-pulse bg-background w-full h-full rounded-full" />
            ) : (
                initials
            )}
        </div>
    );
};

export default StudentAvatar;
