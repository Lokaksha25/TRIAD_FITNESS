import React, { useState, useEffect } from 'react';
import { Save, Loader2, Settings, TrendingDown, TrendingUp, Minus, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserProfile {
    calories: number;
    phase: string;
    protein_target: number;
    notes: string;
}

const ProfileSettings: React.FC = () => {
    const { currentUser } = useAuth();
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
            if (!currentUser) {
                setIsLoading(false);
                return;
            }
            try {
                const response = await fetch(`/api/profile?user_id=${currentUser.uid}`);
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
    }, [currentUser]);

    const handleSave = async () => {
        if (!currentUser) {
            setError('User not authenticated');
            return;
        }

        setIsSaving(true);
        setError(null);
        setSaveSuccess(false);

        try {
            const response = await fetch('/api/profile/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...profile,
                    user_id: currentUser.uid
                })
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
        { value: 'cutting', label: 'Cutting', icon: TrendingDown, description: 'Caloric deficit for fat loss', color: 'text-red-400 bg-red-950/50 border-red-800' },
        { value: 'maintenance', label: 'Maintenance', icon: Minus, description: 'Maintain current weight', color: 'text-amber-400 bg-amber-950/50 border-amber-800' },
        { value: 'bulking', label: 'Bulking', icon: TrendingUp, description: 'Caloric surplus for muscle gain', color: 'text-emerald-400 bg-emerald-950/50 border-emerald-800' }
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
                <p className="text-muted-foreground">Configure your calorie goals and fitness phase. AI agents will use this to personalize recommendations.</p>
            </div>

            {/* Phase Selection */}
            <div className="mb-8">
                <label className="block text-sm font-semibold text-foreground mb-3">Current Phase</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {phaseOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setProfile(prev => ({ ...prev, phase: option.value }))}
                            className={`p-4 rounded-xl border-2 transition-all text-left ${profile.phase === option.value
                                ? `${option.color} ring-2 ring-offset-2 ring-offset-background ring-border`
                                : 'bg-card border-border hover:border-muted'
                                }`}
                        >
                            <div className="flex items-center space-x-2 mb-2">
                                <option.icon size={20} className={profile.phase === option.value ? '' : 'text-muted-foreground'} />
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
                    <span>Suggested: {profile.phase === 'cutting' ? '1600-1800' : profile.phase === 'bulking' ? '2500-3000' : '2000-2200'}</span>
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
                    className="flex items-center space-x-2 px-6 py-3 bg-secondary text-foreground rounded-xl hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium border border-border"
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
                    <span className="text-red-400 text-sm">{error}</span>
                )}

                {saveSuccess && (
                    <span className="text-emerald-400 text-sm font-medium">✓ Profile saved to memory</span>
                )}
            </div>

            {/* Info Card */}
            <div className="mt-8 p-4 bg-card rounded-xl border border-border">
                <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">How it works:</strong> Your profile is saved to Pinecone memory. When you chat with the AI agents,
                    they will automatically reference your calorie goals and phase to provide personalized workout and nutrition advice.
                </p>
            </div>
        </div>
    );
};

export default ProfileSettings;
