import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlobeLoadingScreen from './GlobeLoadingScreen';
import { useDataPrefetch } from '../hooks/useDataPrefetch';

const MIN_DISPLAY_TIME_MS = 2500; // Minimum time to show animation

interface LocationState {
    onboardingData?: {
        user_id: string;
        gender: string;
        age: number;
        weight: number;
        height: number;
        goal: string;
        activity_level: string;
        calculated_calories: number | null;
    };
}

const LoadingTransition: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isExiting, setIsExiting] = useState(false);
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);

    // Get onboarding data from navigation state (if coming from onboarding)
    const onboardingData = useMemo(() => {
        const state = location.state as LocationState | null;
        return state?.onboardingData;
    }, [location.state]);

    // Pass onboarding data to prefetch hook - it will save + fetch in background
    const { isReady, error } = useDataPrefetch(onboardingData);

    // Ensure minimum display time for the animation
    useEffect(() => {
        const timer = setTimeout(() => {
            setMinTimeElapsed(true);
        }, MIN_DISPLAY_TIME_MS);

        return () => clearTimeout(timer);
    }, []);

    // Navigate when both data is ready AND minimum time has passed
    useEffect(() => {
        if (isReady && minTimeElapsed) {
            // Start exit animation
            setIsExiting(true);

            // Navigate after fade-out completes
            const exitTimer = setTimeout(() => {
                navigate('/dashboard', { replace: true });
            }, 500); // Match fadeOut animation duration

            return () => clearTimeout(exitTimer);
        }
    }, [isReady, minTimeElapsed, navigate]);

    // Log any prefetch errors (but don't block navigation)
    useEffect(() => {
        if (error) {
            console.warn('Data prefetch warning:', error);
        }
    }, [error]);

    return <GlobeLoadingScreen isExiting={isExiting} />;
};

export default LoadingTransition;
