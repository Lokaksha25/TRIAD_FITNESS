import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './OnboardingPage.css';

interface OnboardingData {
    gender: 'male' | 'female' | '';
    age: string;
    weight: string;
    height: string;
    goal: 'lose' | 'maintain' | 'gain' | '';
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'very' | 'extreme' | '';
}

const OnboardingPage: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<OnboardingData>({
        gender: '',
        age: '',
        weight: '',
        height: '',
        goal: '',
        activityLevel: ''
    });

    const [calculatedCalories, setCalculatedCalories] = useState<number | null>(null);

    const handleInputChange = (field: keyof OnboardingData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const validateStep1 = (): boolean => {
        if (!formData.gender) {
            setError('Please select your gender');
            return false;
        }
        const age = parseInt(formData.age);
        const weight = parseFloat(formData.weight);
        const height = parseFloat(formData.height);

        if (!age || age < 10 || age > 120) {
            setError('Please enter a valid age (10-120)');
            return false;
        }
        if (!weight || weight < 20 || weight > 300) {
            setError('Please enter a valid weight in kg (20-300)');
            return false;
        }
        if (!height || height < 100 || height > 250) {
            setError('Please enter a valid height in cm (100-250)');
            return false;
        }
        return true;
    };

    const validateStep2 = (): boolean => {
        if (!formData.goal) {
            setError('Please select your goal');
            return false;
        }
        if (!formData.activityLevel) {
            setError('Please select your activity level');
            return false;
        }
        return true;
    };

    const calculateCalories = (): number => {
        const age = parseInt(formData.age);
        const weight = parseFloat(formData.weight);
        const height = parseFloat(formData.height);

        // Mifflin-St Jeor Equation for BMR
        let bmr: number;
        if (formData.gender === 'male') {
            bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
        } else {
            bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
        }

        // Activity multipliers
        const activityMultipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            very: 1.725,
            extreme: 1.9
        };

        const tdee = bmr * activityMultipliers[formData.activityLevel as keyof typeof activityMultipliers];

        // Goal adjustments
        let finalCalories: number;
        if (formData.goal === 'lose') {
            finalCalories = tdee - 500;
        } else if (formData.goal === 'gain') {
            finalCalories = tdee + 500;
        } else {
            finalCalories = tdee;
        }

        return Math.round(finalCalories);
    };

    const handleNext = () => {
        if (step === 1) {
            if (validateStep1()) {
                setStep(2);
            }
        } else if (step === 2) {
            if (validateStep2()) {
                const calories = calculateCalories();
                setCalculatedCalories(calories);
                setStep(3);
            }
        }
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
        setError(null);
    };

    const handleSubmit = () => {
        if (!currentUser) {
            setError('User not authenticated');
            return;
        }

        // Navigate immediately to loading screen, passing onboarding data
        // The loading screen will handle the API call in the background
        navigate('/loading', {
            state: {
                onboardingData: {
                    user_id: currentUser.uid,
                    gender: formData.gender,
                    age: parseInt(formData.age),
                    weight: parseFloat(formData.weight),
                    height: parseFloat(formData.height),
                    goal: formData.goal,
                    activity_level: formData.activityLevel,
                    calculated_calories: calculatedCalories
                }
            }
        });
    };

    return (
        <div className="onboarding-page">
            <div className="onboarding-card">
                <div className="progress-bar">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1</div>
                    <div className={`progress-line ${step >= 2 ? 'active' : ''}`}></div>
                    <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2</div>
                    <div className={`progress-line ${step >= 3 ? 'active' : ''}`}></div>
                    <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3</div>
                </div>

                {error && <div className="error-message">{error}</div>}

                {step === 1 && (
                    <div className="onboarding-step">
                        <h1>Let's Get Started</h1>
                        <p>Tell us about yourself</p>

                        <div className="form-group">
                            <label>Gender</label>
                            <div className="gender-buttons">
                                <button
                                    type="button"
                                    className={`gender-btn ${formData.gender === 'male' ? 'selected' : ''}`}
                                    onClick={() => handleInputChange('gender', 'male')}
                                >
                                    Male
                                </button>
                                <button
                                    type="button"
                                    className={`gender-btn ${formData.gender === 'female' ? 'selected' : ''}`}
                                    onClick={() => handleInputChange('gender', 'female')}
                                >
                                    Female
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Age</label>
                            <input
                                type="number"
                                placeholder="Enter your age"
                                value={formData.age}
                                onChange={(e) => handleInputChange('age', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="Enter your weight in kg"
                                value={formData.weight}
                                onChange={(e) => handleInputChange('weight', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Height (cm)</label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="Enter your height in cm"
                                value={formData.height}
                                onChange={(e) => handleInputChange('height', e.target.value)}
                            />
                        </div>

                        <button className="next-btn" onClick={handleNext}>
                            Next
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="onboarding-step">
                        <h1>Your Fitness Goals</h1>
                        <p>What are you aiming for?</p>

                        <div className="form-group">
                            <label>Goal</label>
                            <div className="goal-buttons">
                                <button
                                    type="button"
                                    className={`goal-btn ${formData.goal === 'lose' ? 'selected' : ''}`}
                                    onClick={() => handleInputChange('goal', 'lose')}
                                >
                                    <i className="fas fa-weight"></i>
                                    <span>Lose Weight</span>
                                </button>
                                <button
                                    type="button"
                                    className={`goal-btn ${formData.goal === 'maintain' ? 'selected' : ''}`}
                                    onClick={() => handleInputChange('goal', 'maintain')}
                                >
                                    <i className="fas fa-balance-scale"></i>
                                    <span>Maintain</span>
                                </button>
                                <button
                                    type="button"
                                    className={`goal-btn ${formData.goal === 'gain' ? 'selected' : ''}`}
                                    onClick={() => handleInputChange('goal', 'gain')}
                                >
                                    <i className="fas fa-dumbbell"></i>
                                    <span>Gain Weight</span>
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Activity Level</label>
                            <select
                                value={formData.activityLevel}
                                onChange={(e) => handleInputChange('activityLevel', e.target.value)}
                            >
                                <option value="">Select your activity level</option>
                                <option value="sedentary">Sedentary (little/no exercise)</option>
                                <option value="light">Lightly Active (1-3 days/week)</option>
                                <option value="moderate">Moderately Active (3-5 days/week)</option>
                                <option value="very">Very Active (6-7 days/week)</option>
                                <option value="extreme">Extremely Active (athlete/physical job)</option>
                            </select>
                        </div>

                        <div className="button-group">
                            <button className="back-btn" onClick={handleBack}>
                                Back
                            </button>
                            <button className="next-btn" onClick={handleNext}>
                                Calculate
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="onboarding-step">
                        <h1>Your Personalized Plan</h1>
                        <p>Based on your information</p>

                        <div className="summary-card">
                            <div className="summary-item">
                                <span className="summary-label">Daily Calorie Target</span>
                                <span className="summary-value">{calculatedCalories} kcal</span>
                            </div>
                            <div className="summary-divider"></div>
                            <div className="summary-grid">
                                <div className="summary-item-small">
                                    <span className="summary-label">Age</span>
                                    <span className="summary-value">{formData.age}</span>
                                </div>
                                <div className="summary-item-small">
                                    <span className="summary-label">Weight</span>
                                    <span className="summary-value">{formData.weight} kg</span>
                                </div>
                                <div className="summary-item-small">
                                    <span className="summary-label">Height</span>
                                    <span className="summary-value">{formData.height} cm</span>
                                </div>
                                <div className="summary-item-small">
                                    <span className="summary-label">Goal</span>
                                    <span className="summary-value">
                                        {formData.goal === 'lose' ? 'Lose Weight' :
                                            formData.goal === 'gain' ? 'Gain Weight' : 'Maintain'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="button-group">
                            <button className="back-btn" onClick={handleBack}>
                                Back
                            </button>
                            <button
                                className="submit-btn"
                                onClick={handleSubmit}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Saving...' : 'Complete Setup'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingPage;
