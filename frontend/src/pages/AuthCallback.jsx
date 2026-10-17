import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const AuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const verifyToken = useAuthStore((state) => state.verifyToken);

    useEffect(() => {
        const SCRIPT_ID = 'pydah-portal-switcher-cdn';
        if (!document.getElementById(SCRIPT_ID)) {
            const script = document.createElement('script');
            script.id = SCRIPT_ID;
            script.src = 'https://crm.pydah.edu.in/portal-switcher.js';
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    useEffect(() => {
        const processAuth = async () => {
            const token = searchParams.get('token');
            const role = searchParams.get('role');

            if (token) {
                try {
                    // Set token to allow API request
                    localStorage.setItem('token', token);

                    // Verify and fetch user details
                    const isValid = await verifyToken();

                    if (isValid) {
                        toast.success('Session restored');
                        if (role === 'student' || searchParams.get('from') === 'ticket_app') {
                            navigate('/student/dashboard', { replace: true });
                        } else {
                            navigate('/', { replace: true });
                        }
                    } else {
                        throw new Error('Token verification failed');
                    }
                } catch (error) {
                    console.error("SSO Error:", error);
                    toast.error("Session invalid");
                    navigate('/login', { replace: true });
                }
            } else {
                navigate('/login', { replace: true });
            }
        };

        processAuth();
    }, [searchParams, navigate, verifyToken]);

    return <pydah-sso-loader />;
};

export default AuthCallback;
