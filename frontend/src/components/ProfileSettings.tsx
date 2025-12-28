import React, { useState, useEffect } from 'react';
import { Save, Loader2, Settings, TrendingDown, TrendingUp, Minus, Check } from 'lucide-react';

interface UserProfile {
    calories: number;
    phase: string;
    protein_target: number;
    notes: string;
}

const ProfileSettings: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile>({
        calories: 2000,
        phase: 'maintenance',
        protein_target: 150,
        notes: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch existing profile on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch('/api/profile');
                const data = await response.json();
                if (data.status === 'success' && data.profile) {
                    setProfile(data.profile);
                }
            } catch (err) {
                console.error('Failed to fetch profile:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSaveSuccess(false);

        try {
            const response = await fetch('/api/profile/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });

            if (!response.ok) throw new Error('Failed to save profile');

            const data = await response.json();
            if (data.status === 'success') {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            }
        } catch (err) {
            setError('Failed to save profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const phaseOptions = [
        { value: 'cutting', label: 'Cutting', icon: TrendingDown, description: 'Caloric deficit for fat loss', color: 'text-red-600 bg-red-50 border-red-200' },
        { value: 'maintenance', label: 'Maintenance', icon: Minus, description: 'Maintain current weight', color: 'text-amber-600 bg-amber-50 border-amber-200' },
        { value: 'bulking', label: 'Bulking', icon: TrendingUp, description: 'Caloric surplus for muscle gain', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-stone-400" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center">
                        <Settings className="text-white" size={20} />
                    </div>
                    <h1 className="text-2xl font-bold text-stone-900">Fitness Profile</h1>
                </div>
                <p className="text-stone-500">Configure your calorie goals and fitness phase. AI agents will use this to personalize recommendations.</p>
            </div>

            {/* Phase Selection */}
            <div className="mb-8">
                <label className="block text-sm font-semibold text-stone-700 mb-3">Current Phase</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {phaseOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setProfile(prev => ({ ...prev, phase: option.value }))}
                            className={`p-4 rounded-xl border-2 transition-all text-left ${profile.phase === option.value
                                    ? `${option.color} ring-2 ring-offset-2 ring-stone-400`
                                    : 'bg-white border-stone-200 hover:border-stone-300'
                                }`}
                        >
                            <div className="flex items-center space-x-2 mb-2">
                                <option.icon size={20} className={profile.phase === option.value ? '' : 'text-stone-400'} />
                                <span className="font-semibold">{option.label}</span>
                            </div>
                            <p className="text-xs text-stone-500">{option.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Calorie Input */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-stone-700 mb-2">Daily Calories (kcal)</label>
                <input
                    type="number"
                    value={profile.calories}
                    onChange={(e) => setProfile(prev => ({ ...prev, calories: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-stone-400 focus:border-stone-400 text-lg font-medium"
                    placeholder="e.g., 2000"
                    min={1000}
                    max={5000}
                />
                <div className="flex justify-between mt-2 text-xs text-stone-400">
                    <span>Suggested: {profile.phase === 'cutting' ? '1600-1800' : profile.phase === 'bulking' ? '2500-3000' : '2000-2200'}</span>
                </div>
            </div>

            {/* Protein Target */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-stone-700 mb-2">Protein Target (grams)</label>
                <input
                    type="number"
                    value={profile.protein_target}
                    onChange={(e) => setProfile(prev => ({ ...prev, protein_target: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-stone-400 focus:border-stone-400 text-lg font-medium"
                    placeholder="e.g., 150"
                    min={50}
                    max={300}
                />
                <p className="mt-2 text-xs text-stone-400">Recommended: 1.6-2.2g per kg body weight</p>
            </div>

            {/* Notes */}
            <div className="mb-8">
                <label className="block text-sm font-semibold text-stone-700 mb-2">Notes (optional)</label>
                <textarea
                    value={profile.notes}
                    onChange={(e) => setProfile(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-stone-400 focus:border-stone-400 resize-none"
                    placeholder="e.g., Preparing for competition, recovering from injury..."
                    rows={3}
                />
            </div>

            {/* Save Button */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white rounded-xl hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                    {isSaving ? (
                        <Loader2 className="animate-spin" size={18} />
                    ) : saveSuccess ? (
                        <Check size={18} />
                    ) : (
                        <Save size={18} />
                    )}
                    <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Profile'}</span>
                </button>

                {error && (
                    <span className="text-red-600 text-sm">{error}</span>
                )}

                {saveSuccess && (
                    <span className="text-emerald-600 text-sm font-medium">✓ Profile saved to memory</span>
                )}
            </div>

            {/* Info Card */}
            <div className="mt-8 p-4 bg-stone-100 rounded-xl border border-stone-200">
                <p className="text-sm text-stone-600">
                    <strong>How it works:</strong> Your profile is saved to Pinecone memory. When you chat with the AI agents,
                    they will automatically reference your calorie goals and phase to provide personalized workout and nutrition advice.
                </p>
            </div>
        </div>
    );
};

export default ProfileSettings;
