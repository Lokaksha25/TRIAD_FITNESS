import React, { useState } from 'react';
import { Target, TrendingDown, Play, CheckCircle, AlertTriangle, Utensils, IndianRupee, Activity, Bed, HeartPulse, Leaf, Drumstick, Flame, Dumbbell, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Types for parsed meal data
interface MealItem {
  name: string;
  price: number;
  description: string;
  type: 'main' | 'accompaniment';
}

interface ParsedMealPlan {
  intro: string;
  mainDish: MealItem | null;
  accompaniments: MealItem[];
  totalCost: number;
  nutrients: {
    protein: { total: number; breakdown: string };
    calcium: { total: number; breakdown: string };
    iron: { total: number; breakdown: string };
  };
  whyItWorks: string;
}

// Parser function to extract structured data from meal plan text
const parseMealPlan = (text: string): ParsedMealPlan | null => {
  try {
    // 1. Try Direct JSON parsing
    // Cleanup any markdown code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanText);

    return {
      intro: data.intro || "Here is your personalized meal plan.",
      mainDish: data.mainDish,
      accompaniments: data.accompaniments || [],
      totalCost: data.totalCost || 0,
      nutrients: data.nutrients || {
        protein: { total: 0, breakdown: "N/A" },
        calcium: { total: 0, breakdown: "N/A" },
        iron: { total: 0, breakdown: "N/A" }
      },
      whyItWorks: data.whyItWorks || "Balanced choice."
    };
  } catch (e) {
    console.log("JSON parse failed, trying fallback regex:", e);

    // Fallback: Return null to show raw text if it's not JSON
    // Or we could implement the old regex here as a last resort,
    // but if the backend is strictly JSON now, we prefer to fail or show raw.
    return null;
  }
};

// Meal Card Component
const MealCard: React.FC<{ item: MealItem; isMain?: boolean; dietType: string }> = ({ item, isMain = false, dietType }) => {
  const isVeg = dietType === 'Vegetarian';

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${isMain ? 'col-span-full' : ''} 
      ${isVeg
        ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50 border-emerald-200'
        : 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-200'
      } p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}
    >
      {/* Type Badge */}
      <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold 
        ${isMain
          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
          : 'bg-white/80 text-stone-600 border border-stone-200'
        }`}
      >
        {isMain ? '⭐ Main Dish' : '🥗 Side'}
      </div>

      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3
        ${isVeg ? 'bg-emerald-100' : 'bg-orange-100'}`}
      >
        {isVeg ? (
          <Leaf className={`${isVeg ? 'text-emerald-600' : 'text-orange-600'}`} size={24} />
        ) : (
          <Drumstick className="text-orange-600" size={24} />
        )}
      </div>

      {/* Name & Price */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className={`font-bold ${isMain ? 'text-xl' : 'text-lg'} text-stone-800`}>
          {item.name}
        </h4>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold text-sm whitespace-nowrap
          ${isVeg
            ? 'bg-emerald-600 text-white'
            : 'bg-orange-600 text-white'
          }`}
        >
          <IndianRupee size={14} />
          {item.price}
        </div>
      </div>

      {/* Description */}
      <p className="text-stone-600 text-sm leading-relaxed">
        {item.description}
      </p>
    </div>
  );
};

// Nutrient Pill Component
const NutrientPill: React.FC<{ label: string; value: number; unit: string; breakdown: string; color: string; icon: React.ReactNode }> =
  ({ label, value, unit, breakdown, color, icon }) => (
    <div className={`group relative bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md transition-all`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-stone-500 font-medium">{label}</p>
          <p className="text-lg font-bold text-stone-800">{value.toFixed(1)}{unit}</p>
        </div>
      </div>
      {breakdown && (
        <p className="text-xs text-stone-400 mt-2 line-clamp-2" title={breakdown}>
          {breakdown}
        </p>
      )}
    </div>
  );

const NutritionistView: React.FC = () => {
  // Mode State
  const [mode, setMode] = useState<'planner' | 'scanner'>('planner');

  // Meal Planner State
  const [goal, setGoal] = useState<string>('Muscle Gain');
  const [dietType, setDietType] = useState<string>('Vegetarian');
  const [budget, setBudget] = useState<number>(500);
  const [sleepScore, setSleepScore] = useState<number>(70);
  const [stressLevel, setStressLevel] = useState<string>('Moderate');
  const [caloriesBurned, setCaloriesBurned] = useState<number>(600);
  const [fitnessCoachPlan, setFitnessCoachPlan] = useState<string>(
    "User just finished a High Intensity Interval Training (HIIT) session. Leg day focus. Needs recovery."
  );
  const [mealResult, setMealResult] = useState<string | null>(null);

  // Scanner State
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any | null>(null);

  // Common State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const startNutritionSession = async () => {
    setLoading(true);
    setMealResult(null);
    setError(null);

    const wellnessData = {
      sleep_score: sleepScore,
      stress_level: stressLevel,
      calories_burned: caloriesBurned
    };

    try {
      const response = await fetch('/api/nutrition/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal,
          diet_type: dietType,
          budget: budget,
          wellness_data: wellnessData,
          fitness_coach_plan: fitnessCoachPlan
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to generate plan');
      }

      const data = await response.json();
      setMealResult(data.result);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setScanFile(file);
      setScanPreview(URL.createObjectURL(file));
      setScanResult(null);
      setError(null);
    }
  };

  const startScan = async () => {
    if (!scanFile) return;

    setLoading(true);
    setScanResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', scanFile);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to scan image');
      }

      const data = await response.json();
      setScanResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Parse the result
  const parsedPlan = mealResult ? parseMealPlan(mealResult) : null;

  return (
    <div className="grid grid-cols-1 lg:col-span-3 gap-6 h-full pb-12">
      {/* Left Column: Input Configuration */}
      <div className="lg:col-span-1 space-y-6">

        {/* Mode Toggle */}
        <div className="bg-stone-100 p-1 rounded-xl flex">
          <button
            onClick={() => setMode('planner')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'planner' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Meal Planner
          </button>
          <button
            onClick={() => setMode('scanner')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'scanner' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            NutriScan
          </button>
        </div>

        {mode === 'planner' ? (
          <>
            <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Utensils className="text-stone-400" size={20} />
                <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider">User Profile</h3>
              </div>

              <div className="space-y-6">
                {/* Goal Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Fitness Goal</label>
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    disabled={loading}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Muscle Gain">Muscle Gain (Hypertrophy)</option>
                    <option value="Weight Loss">Weight Loss (Fat Burn)</option>
                    <option value="General Health">General Health & Wellness</option>
                  </select>
                </div>

                {/* Diet Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Diet Preference</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDietType('Vegetarian')}
                      disabled={loading}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border ${dietType === 'Vegetarian' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                      Vegetarian
                    </button>
                    <button
                      onClick={() => setDietType('Non-Vegetarian')}
                      disabled={loading}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border ${dietType === 'Non-Vegetarian' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                      Non-Veg
                    </button>
                  </div>
                </div>

                {/* Budget */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-stone-700">Budget (per meal)</label>
                    <span className="text-sm font-bold text-stone-900">₹{budget}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value))}
                    disabled={loading}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-xs text-stone-400">
                    <span>₹100</span>
                    <span>₹2000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Incoming Signals (Wellness & Fitness Coach) */}
            <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="text-stone-400" size={20} />
                <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider">Incoming Signals</h3>
              </div>
              <div className="space-y-4">
                {/* Wellness Data */}
                <h4 className="text-stone-600 text-sm font-medium flex items-center gap-2"><HeartPulse size={16} /> Wellness Manager</h4>
                <div className="space-y-2 pl-2 border-l border-stone-100">
                  <label className="text-xs font-medium text-stone-500 block">Sleep Score (Last Night)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={sleepScore}
                    onChange={(e) => setSleepScore(parseInt(e.target.value))}
                    disabled={loading}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-stone-400 outline-none"
                  />
                  <label className="text-xs font-medium text-stone-500 block mt-2">Stress Level</label>
                  <select
                    value={stressLevel}
                    onChange={(e) => setStressLevel(e.target.value)}
                    disabled={loading}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-stone-400 outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                  </select>
                  <label className="text-xs font-medium text-stone-500 block mt-2">Active Calories Burned</label>
                  <input
                    type="number"
                    min="0"
                    value={caloriesBurned}
                    onChange={(e) => setCaloriesBurned(parseInt(e.target.value))}
                    disabled={loading}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-stone-400 outline-none"
                  />
                </div>

                {/* Fitness Coach Plan */}
                <h4 className="text-stone-600 text-sm font-medium mt-4 flex items-center gap-2"><Activity size={16} /> Fitness Coach</h4>
                <div className="space-y-2 pl-2 border-l border-stone-100">
                  <label className="text-xs font-medium text-stone-500 block">Incoming Signal (Workout Context)</label>
                  <textarea
                    value={fitnessCoachPlan}
                    onChange={(e) => setFitnessCoachPlan(e.target.value)}
                    disabled={loading}
                    rows={4}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-stone-400 outline-none resize-none"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={startNutritionSession}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white transition-all ${loading ? 'bg-stone-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg'}`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Analyzing with AI...</span>
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  <span>Generate Meal Plan</span>
                </>
              )}
            </button>
          </>
        ) : (
          // Scanner Mode Input
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-stone-900 font-bold">NutriScan AI</h3>
                <p className="text-xs text-stone-400">Scan food for instant analysis</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${scanFile ? 'border-blue-500 bg-blue-50' : 'border-stone-200 hover:border-blue-400 hover:bg-stone-50'}`}>
                {scanPreview ? (
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-4 shadow-sm">
                    <img src={scanPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setScanFile(null); setScanPreview(null); setScanResult(null); }}
                      className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md text-stone-500 hover:text-red-500"
                    >
                      <div className="w-4 h-4 flex items-center justify-center">×</div>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                      <Target size={24} />
                    </div>
                    <p className="text-sm font-medium text-stone-700 mb-1">Click to upload image</p>
                    <p className="text-xs text-stone-400">Supports JPG, PNG</p>
                  </>
                )}

                {!scanFile && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                )}
              </div>

              <button
                onClick={startScan}
                disabled={loading || !scanFile}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white transition-all ${loading || !scanFile ? 'bg-stone-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'}`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Target size={18} />
                    <span>Analyze Food</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Center/Right: Results Visualization */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
            <AlertTriangle size={20} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {mode === 'planner' ? (
          // Meal Planner Results (Existing)
          <div className="flex-1 bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden min-h-[500px]">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Your Personalized Meal</h2>
                <p className="text-stone-500 text-sm">AI-crafted based on your goals, wellness & workout</p>
              </div>
              {parsedPlan && (
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100 flex items-center gap-1">
                  <CheckCircle size={14} />
                  PLAN READY
                </div>
              )}
            </div>

            {/* Content Area */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-60">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-stone-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-stone-400 font-mono text-sm">Consulting Nutritionist Agent...</p>
              </div>
            ) : parsedPlan ? (
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {/* Intro Card */}
                {parsedPlan.intro && (
                  <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-xl p-4 border border-indigo-100">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Sparkles className="text-white" size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-indigo-900 mb-1">Personalized for You</p>
                        <p className="text-stone-600 text-sm leading-relaxed">{parsedPlan.intro}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Meal Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parsedPlan.mainDish && (
                    <MealCard item={parsedPlan.mainDish} isMain={true} dietType={dietType} />
                  )}
                  {parsedPlan.accompaniments.map((acc, idx) => (
                    <MealCard key={idx} item={acc} dietType={dietType} />
                  ))}
                </div>

                {/* Total Cost Badge */}
                {parsedPlan.totalCost > 0 && (
                  <div className="flex items-center justify-between bg-gradient-to-r from-stone-50 to-stone-100 rounded-xl p-4 border border-stone-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <IndianRupee className="text-emerald-600" size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-stone-500 font-medium">Total Meal Cost</p>
                        <p className="text-2xl font-bold text-stone-800">₹{parsedPlan.totalCost}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-bold ${parsedPlan.totalCost <= budget
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                      }`}>
                      {parsedPlan.totalCost <= budget
                        ? `✓ Within ₹${budget} budget`
                        : `Over budget by ₹${parsedPlan.totalCost - budget}`
                      }
                    </div>
                  </div>
                )}

                {/* Micronutrient Grid */}
                <div>
                  <h4 className="text-xs font-bold text-stone-400 uppercase mb-3 flex items-center gap-2">
                    <Dumbbell size={14} />
                    Nutrition Breakdown
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <NutrientPill
                      label="Protein"
                      value={parsedPlan.nutrients.protein.total}
                      unit="g"
                      breakdown={parsedPlan.nutrients.protein.breakdown}
                      color="bg-emerald-100"
                      icon={<Flame className="text-emerald-600" size={18} />}
                    />
                    <NutrientPill
                      label="Calcium"
                      value={parsedPlan.nutrients.calcium.total}
                      unit="mg"
                      breakdown={parsedPlan.nutrients.calcium.breakdown}
                      color="bg-blue-100"
                      icon={<Target className="text-blue-600" size={18} />}
                    />
                    <NutrientPill
                      label="Iron"
                      value={parsedPlan.nutrients.iron.total}
                      unit="mg"
                      breakdown={parsedPlan.nutrients.iron.breakdown}
                      color="bg-amber-100"
                      icon={<TrendingDown className="text-amber-600" size={18} />}
                    />
                  </div>
                </div>

                {/* Why It Works */}
                {parsedPlan.whyItWorks && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="text-white" size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-800 mb-1">Why This Meal Works</p>
                        <p className="text-stone-600 text-sm leading-relaxed">{parsedPlan.whyItWorks}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : mealResult ? (
              // Fallback: If parsing fails, show formatted text
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="prose prose-stone max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-stone-700 leading-relaxed text-sm bg-stone-50 p-6 rounded-lg border border-stone-100">
                    {mealResult}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-stone-400 space-y-4">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
                    <Utensils size={40} className="text-emerald-300" />
                  </div>
                </div>
                <p className="text-sm font-medium">Configure your preferences and generate a plan</p>
                <p className="text-xs text-stone-300">Your personalized meal will appear here</p>
              </div>
            )}
          </div>
        ) : (
          // Scanner Mode Results
          <div className="flex-1 bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden min-h-[500px]">
            <div className="flex justify-between items-start mb-6 border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">NutriScan Analysis</h2>
                <p className="text-stone-500 text-sm">Visual analysis via Gemini Vision</p>
              </div>
              {scanResult && (
                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 flex items-center gap-1">
                  <Target size={14} />
                  ANALYSIS COMPLETE
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-60">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-stone-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-stone-400 font-mono text-sm">Scanning image contents...</p>
              </div>
            ) : scanResult ? (
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {/* Product Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{scanResult.brandName}</p>
                    <h3 className="text-3xl font-bold text-stone-900">{scanResult.productName}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-1 bg-stone-100 rounded text-xs font-medium text-stone-600">{scanResult.processingLabel}</span>
                      {scanResult.isExpired && <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold">⚠️ EXPIRED</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-bold ${scanResult.healthScore >= 70 ? 'text-emerald-600' : scanResult.healthScore >= 40 ? 'text-amber-500' : 'text-red-600'}`}>
                      {scanResult.healthScore}
                    </div>
                    <p className="text-xs text-stone-400 font-medium">Health Score</p>
                  </div>
                </div>

                {/* Nutrition Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <p className="text-xs text-stone-400 mb-1">Calories</p>
                    <p className="text-xl font-bold text-stone-800">{scanResult.nutrition.calories}</p>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <p className="text-xs text-stone-400 mb-1">Protein</p>
                    <p className="text-xl font-bold text-stone-800">{scanResult.nutrition.protein}g</p>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <p className="text-xs text-stone-400 mb-1">Carbs</p>
                    <p className="text-xl font-bold text-stone-800">{scanResult.nutrition.carbs}g</p>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <p className="text-xs text-stone-400 mb-1">Sugar</p>
                    <p className="text-xl font-bold text-stone-800">{scanResult.nutrition.sugar}g</p>
                  </div>
                </div>

                {/* Warnings */}
                {scanResult.warnings.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Health Warnings
                    </h4>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                      {scanResult.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ingredients */}
                <div>
                  <h4 className="text-sm font-bold text-stone-800 mb-3">Ingredient Analysis</h4>
                  <div className="space-y-2">
                    {scanResult.ingredients.map((ing: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-stone-100 rounded-lg hover:shadow-sm transition-all">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${ing.riskLevel === 'High' ? 'bg-red-500' : ing.riskLevel === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                        <div>
                          <p className="text-sm font-bold text-stone-800">{ing.name}</p>
                          <p className="text-xs text-stone-500">{ing.description}</p>
                        </div>
                        <span className="ml-auto text-xs font-mono bg-stone-50 px-2 py-1 rounded">{ing.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alternatives */}
                {scanResult.alternatives.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                      <Leaf size={16} />
                      Healthier Alternatives
                    </h4>
                    <div className="space-y-2">
                      {scanResult.alternatives.map((alt: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-2 bg-white/60 rounded-lg">
                          <span className="font-bold text-emerald-900">{alt.name}</span>
                          <span className="text-xs text-emerald-700">{alt.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-stone-400 space-y-4">
                <div className="p-4 bg-blue-50 text-blue-300 rounded-full">
                  <Target size={40} />
                </div>
                <p className="text-sm font-medium">Upload an image to start scanning</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NutritionistView;