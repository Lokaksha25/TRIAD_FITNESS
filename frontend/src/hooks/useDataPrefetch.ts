import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveOnboardingData, OnboardingData } from '../services/userDataService';

interface PrefetchState {
    isReady: boolean;
    error: string | null;
    progress: number;
}

const MIN_LOADING_TIME_MS = 2500; // Minimum time to show loading animation

export const useDataPrefetch = (onboardingData?: OnboardingData): PrefetchState => {
    const { currentUser } = useAuth();
    const [state, setState] = useState<PrefetchState>({
        isReady: false,
        error: null,
        progress: 0,
    });

    useEffect(() => {
        if (!currentUser) {
            setState({ isReady: false, error: 'User not authenticated', progress: 0 });
            return;
        }

        const startTime = Date.now();

        const prefetchData = async () => {
            try {
                setState(prev => ({ ...prev, progress: 10 }));

                // Step 1: Save onboarding data to localStorage (if provided)
                if (onboardingData) {
                    console.log('💾 Saving onboarding data to local storage...');
                    saveOnboardingData(onboardingData);
                    setState(prev => ({ ...prev, progress: 40 }));
                }

                // Step 2: Save to backend (BLOCKING - fail if this fails)
                if (onboardingData) {
                    const response = await fetch('/api/user/onboarding', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(onboardingData),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Backend save failed: ${response.status} ${errorText}`);
                    }
                    console.log('✅ Onboarding data saved to backend');
                }

                setState(prev => ({ ...prev, progress: 70 }));

                // Step 3: Try to fetch additional data from backend (optional enhancement)
                try {
                    await Promise.all([
                        fetch(`/api/dashboard/metrics?user_id=${currentUser.uid}`).catch(() => null),
                        fetch(`/api/profile?user_id=${currentUser.uid}`).catch(() => null),
                    ]);
                } catch (err) {
                    console.warn('⚠️ Backend fetch failed (using local data):', err);
                }

                setState(prev => ({ ...prev, progress: 90 }));

                // Ensure minimum loading time for smooth UX
                const elapsed = Date.now() - startTime;
                if (elapsed < MIN_LOADING_TIME_MS) {
                    await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME_MS - elapsed));
                }

                setState({ isReady: true, error: null, progress: 100 });

            } catch (err: any) {
                console.error('Prefetch error:', err);
                // isReady: false ensures we don't navigate to dashboard on critical error
                setState({ isReady: false, error: err.message || 'Prefetch failed', progress: 100 });
            }
        };

        prefetchData();
    }, [currentUser, onboardingData]);

    return state;
};

export default useDataPrefetch;
