import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, Settings, TrendingDown, TrendingUp, Minus, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getOnboardingData, saveOnboardingData, computeUserMetrics, goalToPhase } from '../services/userDataService';

interface ProfileData {
    calories: number;
    phase: string;
    protein_target: number;
    weight: number;
    height: number;
    age: number;
    goal: 'lose' | 'maintain' | 'gain';
    notes: string;
}

const ProfileSettings: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [profile, setProfile] = useState<ProfileData>({
        calories: 2000,
        phase: 'maintenance',
        protein_target: 150,
        weight: 70,
        height: 170,
        age: 25,
        goal: 'maintain',
        notes: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load profile from onboarding data
    useEffect(() => {
        const loadProfile = () => {
            if (!currentUser) {
                setIsLoading(false);
                return;
            }

            const onboardingData = getOnboardingData();
            if (onboardingData) {
                console.log('📦 Loading profile from onboarding data');
                const metrics = computeUserMetrics(onboardingData);
                setProfile({
                    calories: metrics.calories,
                    phase: onboardingData.goal,
                    protein_target: metrics.proteinTarget,
                    weight: onboardingData.weight,
                    height: onboardingData.height,
                    age: onboardingData.age,
                    goal: onboardingData.goal as 'lose' | 'maintain' | 'gain',
                    notes: ''
                });
            }
            setIsLoading(false);
        };
        loadProfile();
    }, [currentUser]);

    const handleSave = () => {
        if (!currentUser) {
            setError('User not authenticated');
            return;
        }

        // Update the onboarding data with new values
        const updatedOnboardingData = {
            user_id: currentUser.uid,
            gender: getOnboardingData()?.gender || 'male',
            age: profile.age,
            weight: profile.weight,
            height: profile.height,
            goal: profile.goal,
            activity_level: getOnboardingData()?.activity_level || 'moderate',
            calculated_calories: profile.calories
        };

        // Navigate to loading screen with updated data
        // This will save the data and show animation while updating
        navigate('/loading', {
            state: {
                onboardingData: updatedOnboardingData
            }
        });
    };

    const phaseOptions = [
        { value: 'lose', label: 'Cutting', icon: TrendingDown, description: 'Caloric deficit for fat loss', color: 'text-red-400 bg-red-950/50 border-red-800' },
        { value: 'maintain', label: 'Maintenance', icon: Minus, description: 'Maintain current weight', color: 'text-amber-400 bg-amber-950/50 border-amber-800' },
        { value: 'gain', label: 'Bulking', icon: TrendingUp, description: 'Caloric surplus for muscle gain', color: 'text-emerald-400 bg-emerald-950/50 border-emerald-800' }
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-muted-foreground" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center border border-border">
                        <Settings className="text-foreground" size={20} />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Fitness Profile</h1>
                </div>
                <p className="text-muted-foreground">Update your fitness goals. Changes will sync with your dashboard.</p>
            </div>

            {/* Body Metrics */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Weight (kg)</label>
                    <input
                        type="number"
                        value={profile.weight}
                        onChange={(e) => setProfile(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-border focus:border-border text-lg font-medium"
                        placeholder="70"
                        min={30}
                        max={300}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Height (cm)</label>
                    <input
                        type="number"
                        value={profile.height}
                        onChange={(e) => setProfile(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-border focus:border-border text-lg font-medium"
                        placeholder="170"
                        min={100}
                        max={250}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Age</label>
                    <input
                        type="number"
                        value={profile.age}
                        onChange={(e) => setProfile(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-border focus:border-border text-lg font-medium"
                        placeholder="25"
                        min={10}
                        max={120}
                    />
                </div>
            </div>

            {/* Phase Selection */}
            <div className="mb-8">
                <label className="block text-sm font-semibold text-foreground mb-3">Current Goal</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {phaseOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setProfile(prev => ({ ...prev, goal: option.value as 'lose' | 'maintain' | 'gain' }))}
                            className={`p-4 rounded-xl border-2 transition-all text-left ${profile.goal === option.value
                                ? `${option.color} ring-2 ring-offset-2 ring-offset-background ring-border`
                                : 'bg-card border-border hover:border-muted'
                                }`}
                        >
                            <div className="flex items-center space-x-2 mb-2">
                                <option.icon size={20} className={profile.goal === option.value ? '' : 'text-muted-foreground'} />
                                <span className="font-semibold text-foreground">{option.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Calorie Input */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">Daily Calories (kcal)</label>
                <input
                    type="number"
                    value={profile.calories}
                    onChange={(e) => setProfile(prev => ({ ...prev, calories: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-border focus:border-border text-lg font-medium"
                    placeholder="e.g., 2000"
                    min={1000}
                    max={5000}
                />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Suggested: {profile.goal === 'lose' ? '1600-1800' : profile.goal === 'gain' ? '2500-3000' : '2000-2200'}</span>
                </div>
            </div>

            {/* Protein Target */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">Protein Target (grams)</label>
                <input
                    type="number"
                    value={profile.protein_target}
                    onChange={(e) => setProfile(prev => ({ ...prev, protein_target: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-border focus:border-border text-lg font-medium"
                    placeholder="e.g., 150"
                    min={50}
                    max={300}
                />
                <p className="mt-2 text-xs text-muted-foreground">Recommended: 1.6-2.2g per kg body weight</p>
            </div>

            {/* Notes */}
            <div className="mb-8">
                <label className="block text-sm font-semibold text-foreground mb-2">Notes (optional)</label>
                <textarea
                    value={profile.notes}
                    onChange={(e) => setProfile(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-border focus:border-border resize-none placeholder:text-muted-foreground"
                    placeholder="e.g., Preparing for competition, recovering from injury..."
                    rows={3}
                />
            </div>

            {/* Save Button */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white rounded-xl hover:from-cyan-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-lg"
                >
                    <Save size={18} />
                    <span>Save & Update Dashboard</span>
                </button>

                {error && (
                    <span className="text-red-400 text-sm">{error}</span>
                )}
            </div>

            {/* Info Card */}
            <div className="mt-8 p-4 bg-card rounded-xl border border-border">
                <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">How it works:</strong> When you save changes, you'll see a loading animation while your data is synced. Your dashboard will automatically update with the new values.
                </p>
            </div>
        </div>
    );
};

export default ProfileSettings;
