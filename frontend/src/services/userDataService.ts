// User data storage service - manages onboarding data in localStorage
// This allows dashboard to show user's actual data even without backend

export interface OnboardingData {
    user_id: string;
    gender: 'male' | 'female';
    age: number;
    weight: number;  // kg
    height: number;  // cm
    goal: 'lose' | 'maintain' | 'gain';
    activity_level: 'sedentary' | 'light' | 'moderate' | 'very' | 'extreme';
    calculated_calories: number | null;
}

export interface ComputedUserMetrics {
    bmi: number;
    bmiCategory: string;
    phase: string;
    calories: number;
    status: string;
    proteinTarget: number;
}

const ONBOARDING_CACHE_KEY = 'user_onboarding_data';

// Save onboarding data to localStorage
export const saveOnboardingData = (data: OnboardingData): void => {
    localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
    }));
    console.log('✅ Onboarding data saved to local storage');
};

// Get onboarding data from localStorage
export const getOnboardingData = (): OnboardingData | null => {
    try {
        const cached = localStorage.getItem(ONBOARDING_CACHE_KEY);
        if (cached) {
            const { data } = JSON.parse(cached);
            return data as OnboardingData;
        }
    } catch (e) {
        console.error('Error reading onboarding data:', e);
    }
    return null;
};

// Compute BMI from weight (kg) and height (cm)
export const computeBMI = (weight: number, height: number): number => {
    const heightInMeters = height / 100;
    return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10;
};

// Get BMI category
export const getBMICategory = (bmi: number): string => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
};

// Map goal to phase name
export const goalToPhase = (goal: string): string => {
    const mapping: Record<string, string> = {
        'lose': 'Cutting',
        'maintain': 'Maintenance',
        'gain': 'Bulking',
    };
    return mapping[goal] || 'Maintenance';
};

// Compute protein target based on weight and goal
export const computeProteinTarget = (weight: number, goal: string): number => {
    // 1.6-2.2g per kg body weight depending on goal
    const multiplier = goal === 'gain' ? 2.2 : goal === 'lose' ? 2.0 : 1.6;
    return Math.round(weight * multiplier);
};

// Get status based on goal
export const getStatusFromGoal = (goal: string): string => {
    const mapping: Record<string, string> = {
        'lose': 'Active Cut',
        'maintain': 'Stable',
        'gain': 'Active Bulk',
    };
    return mapping[goal] || 'Stable';
};

// Compute all user metrics from onboarding data
export const computeUserMetrics = (data: OnboardingData): ComputedUserMetrics => {
    const bmi = computeBMI(data.weight, data.height);
    return {
        bmi,
        bmiCategory: getBMICategory(bmi),
        phase: goalToPhase(data.goal),
        calories: data.calculated_calories || 2000,
        status: getStatusFromGoal(data.goal),
        proteinTarget: computeProteinTarget(data.weight, data.goal),
    };
};

// Clear all user data (for logout)
export const clearUserData = (): void => {
    localStorage.removeItem(ONBOARDING_CACHE_KEY);
    localStorage.removeItem('dashboard_metrics_cache');
    localStorage.removeItem('profile_cache');
};
