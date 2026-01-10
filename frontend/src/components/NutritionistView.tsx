import React, { useState } from 'react';
import { Target, TrendingDown, Play, CheckCircle, AlertTriangle, Utensils, IndianRupee, Activity, Bed, HeartPulse, Leaf, Drumstick, Flame, Dumbbell, Sparkles, ChevronDown, ChevronUp, Settings, Sun, Coffee, Moon, Youtube, ShoppingCart, BookOpen, ExternalLink } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './ui/CustomSelect';

// Types for parsed meal data
interface MealItem {
  name: string;
  price: number;
  description: string;
  type: 'main' | 'accompaniment';
}

interface Ingredient {
  name: string;
  qty: string;
  cost_inr: number;
  blinkit: string;
}

interface SingleMeal {
  mealName: string;
  mainDish: MealItem | null;
  accompaniments: MealItem[];
  totalCost: number;
  nutrients: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
  recipe: string[];           // Recipe steps
  youtubeLink: string;        // YouTube recipe URL
  ingredients: Ingredient[];  // Ingredients with Blinkit links
}

interface ProteinBooster {
  name: string;
  protein: number;
  price: number;
  blinkit: string;
  description: string;
}

interface ParsedMealPlan {
  intro: string;
  meals: {
    breakfast: SingleMeal | null;
    lunch: SingleMeal | null;
    dinner: SingleMeal | null;
    snacks: SingleMeal | null;
  };
  totalMacros: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
  proteinTarget: number;
  totalDailyCost: number;
  whyItWorks: string;
  proteinBoosters: ProteinBooster[];
}

// Parser function to extract structured data from meal plan text
const parseMealPlan = (text: string): ParsedMealPlan | null => {
  try {
    // Cleanup any markdown code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanText);

    const parseMeal = (meal: any): SingleMeal | null => {
      if (!meal) return null;
      return {
        mealName: meal.mealName || "Meal",
        mainDish: meal.mainDish || null,
        accompaniments: meal.accompaniments || [],
        totalCost: meal.totalCost || 0,
        nutrients: {
          protein: meal.nutrients?.protein || 0,
          carbs: meal.nutrients?.carbs || 0,
          fat: meal.nutrients?.fat || 0,
          calories: meal.nutrients?.calories || 0
        },
        recipe: meal.recipe || [],
        youtubeLink: meal.youtubeLink || '',
        ingredients: meal.ingredients || []
      };
    };

    return {
      intro: data.intro || "Here is your personalized daily meal plan.",
      meals: {
        breakfast: parseMeal(data.meals?.breakfast),
        lunch: parseMeal(data.meals?.lunch),
        dinner: parseMeal(data.meals?.dinner),
        snacks: parseMeal(data.meals?.snacks)
      },
      totalMacros: {
        protein: data.totalMacros?.protein || 0,
        carbs: data.totalMacros?.carbs || 0,
        fat: data.totalMacros?.fat || 0,
        calories: data.totalMacros?.calories || 0
      },
      proteinTarget: data.proteinTarget || 100,
      totalDailyCost: data.totalDailyCost || 0,
      whyItWorks: data.whyItWorks || "Balanced daily nutrition.",
      proteinBoosters: data.proteinBoosters || []
    };
  } catch (e) {
    console.log("JSON parse failed, trying fallback regex:", e);
    return null;
  }
};

// Meal Card Component
const MealCard: React.FC<{ item: MealItem; isMain?: boolean; dietType: string }> = ({ item, isMain = false, dietType }) => {
  const isVeg = dietType === 'Vegetarian';

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${isMain ? 'col-span-full' : ''} 
      ${isVeg
        ? 'bg-emerald-950/30 border-emerald-800'
        : 'bg-orange-950/30 border-orange-800'
      } p-5 transition-all duration-300 hover:border-opacity-80`}
    >
      {/* Type Badge */}
      <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold 
        ${isMain
          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
          : 'bg-secondary text-muted-foreground border border-border'
        }`}
      >
        {isMain ? '⭐ Main Dish' : '🥗 Side'}
      </div>

      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3
        ${isVeg ? 'bg-emerald-900/50' : 'bg-orange-900/50'}`}
      >
        {isVeg ? (
          <Leaf className={`${isVeg ? 'text-emerald-400' : 'text-orange-400'}`} size={24} />
        ) : (
          <Drumstick className="text-orange-400" size={24} />
        )}
      </div>

      {/* Name & Price */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className={`font-bold ${isMain ? 'text-xl' : 'text-lg'} text-foreground`}>
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
      <p className="text-muted-foreground text-sm leading-relaxed">
        {item.description}
      </p>
    </div>
  );
};

// Nutrient Pill Component (simplified for totals)
const NutrientPill: React.FC<{ label: string; value: number; unit: string; breakdown?: string; color: string; icon: React.ReactNode }> =
  ({ label, value, unit, breakdown, color, icon }) => (
    <div className={`group relative bg-card rounded-xl border border-border p-4 hover:border-muted transition-all`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-lg font-bold text-foreground">{Math.round(value)}{unit}</p>
        </div>
      </div>
      {breakdown && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2" title={breakdown}>
          {breakdown}
        </p>
      )}
    </div>
  );

// Collapsible Meal Section Component
const CollapsibleMealSection: React.FC<{
  meal: SingleMeal;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  dietType: string;
  budget: number;
  defaultOpen?: boolean;
}> = ({ meal, mealType, dietType, budget, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const mealConfig = {
    breakfast: { icon: Coffee, label: 'Breakfast', gradient: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-700', iconColor: 'text-amber-400', bg: 'bg-amber-950/30' },
    lunch: { icon: Sun, label: 'Lunch', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-700', iconColor: 'text-blue-400', bg: 'bg-blue-950/30' },
    dinner: { icon: Moon, label: 'Dinner', gradient: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-700', iconColor: 'text-purple-400', bg: 'bg-purple-950/30' },
    snacks: { icon: Sparkles, label: 'Snacks', gradient: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-700', iconColor: 'text-emerald-400', bg: 'bg-emerald-950/30' }
  };

  const config = mealConfig[mealType];
  const Icon = config.icon;
  const isVeg = dietType === 'Vegetarian';

  return (
    <div className={`rounded-xl border ${config.border} overflow-hidden`}>
      {/* Header - clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-4 flex items-center justify-between ${config.bg} hover:opacity-90 transition-all`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient}`}>
            <Icon className={config.iconColor} size={20} />
          </div>
          <div className="text-left">
            <h4 className="text-foreground font-bold">{config.label}</h4>
            <p className="text-xs text-muted-foreground">{meal.mealName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${meal.totalCost <= budget ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            <IndianRupee size={14} />
            {meal.totalCost}
          </div>
          {isOpen ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div className="p-4 border-t border-border/50 bg-card space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Main Dish */}
          {meal.mainDish && (
            <div className={`p-4 rounded-lg border ${isVeg ? 'bg-emerald-950/20 border-emerald-800' : 'bg-orange-950/20 border-orange-800'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white">⭐ Main</span>
                  <h5 className="font-bold text-foreground">{meal.mainDish.name}</h5>
                </div>
                <span className="text-sm font-bold text-emerald-400">₹{meal.mainDish.price}</span>
              </div>
              <p className="text-sm text-muted-foreground">{meal.mainDish.description}</p>
            </div>
          )}

          {/* Accompaniments */}
          {meal.accompaniments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meal.accompaniments.map((acc, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${isVeg ? 'bg-emerald-950/10 border-emerald-900' : 'bg-orange-950/10 border-orange-900'}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground border border-border">🥗 Side</span>
                      <h5 className="font-medium text-foreground text-sm">{acc.name}</h5>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">₹{acc.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{acc.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recipe Summary Section */}
          {meal.recipe && meal.recipe.length > 0 && (
            <div className="bg-gradient-to-r from-violet-950/30 to-purple-950/30 rounded-lg p-4 border border-violet-800/50">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-violet-400" />
                <h5 className="text-sm font-bold text-violet-300">Quick Recipe</h5>
              </div>
              <ol className="space-y-1.5">
                {meal.recipe.slice(0, 4).map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="bg-violet-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Action Buttons: YouTube & Blinkit */}
          <div className="flex flex-wrap gap-3 pt-2">
            {meal.youtubeLink && (
              <a
                href={meal.youtubeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
              >
                <Youtube size={18} />
                <span>Watch Recipe</span>
                <ExternalLink size={14} className="opacity-70" />
              </a>
            )}
            {meal.ingredients && meal.ingredients.length > 0 && (
              <a
                href={`https://blinkit.com/s/?q=${encodeURIComponent(meal.ingredients.map(i => i.name).join(' '))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black rounded-lg text-sm font-medium transition-all shadow-md"
              >
                <ShoppingCart size={18} />
                <span>Order on Blinkit</span>
                <ExternalLink size={14} className="opacity-70" />
              </a>
            )}
          </div>

          {/* Meal Nutrients */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Protein</p>
              <p className="font-bold text-emerald-400">{meal.nutrients.protein}g</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Carbs</p>
              <p className="font-bold text-blue-400">{meal.nutrients.carbs}g</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Fat</p>
              <p className="font-bold text-amber-400">{meal.nutrients.fat}g</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Calories</p>
              <p className="font-bold text-foreground">{meal.nutrients.calories}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NutritionistView: React.FC = () => {
  const { currentUser } = useAuth();
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
  const [showSignals, setShowSignals] = useState<boolean>(false);

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
          fitness_coach_plan: fitnessCoachPlan,
          user_id: currentUser?.uid || "user_123"
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full pb-12">
      {/* Left Column: User Profile */}
      <div className="lg:col-span-1 space-y-6">

        {/* Mode Toggle */}
        <div className="bg-secondary p-1 rounded-xl flex border border-border">
          <button
            onClick={() => setMode('planner')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'planner' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Meal Planner
          </button>
          <button
            onClick={() => setMode('scanner')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'scanner' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}
          >
            NutriScan
          </button>
        </div>

        {mode === 'planner' ? (
          <>
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Utensils className="text-muted-foreground" size={20} />
                <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">User Profile</h3>
              </div>

              <div className="space-y-6">
                {/* Goal Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Fitness Goal</label>
                  <CustomSelect
                    value={goal}
                    onChange={setGoal}
                    disabled={loading}
                    options={[
                      { value: 'Muscle Gain', label: 'Muscle Gain (Hypertrophy)' },
                      { value: 'Weight Loss', label: 'Weight Loss (Fat Burn)' },
                      { value: 'General Health', label: 'General Health & Wellness' }
                    ]}
                  />
                </div>

                {/* Diet Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Diet Preference</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDietType('Vegetarian')}
                      disabled={loading}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border ${dietType === 'Vegetarian' ? 'bg-emerald-950/50 border-emerald-700 text-emerald-400' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      Vegetarian
                    </button>
                    <button
                      onClick={() => setDietType('Non-Vegetarian')}
                      disabled={loading}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border ${dietType === 'Non-Vegetarian' ? 'bg-red-950/50 border-red-700 text-red-400' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      Non-Veg
                    </button>
                  </div>
                </div>

                {/* Budget */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-foreground">Budget (per meal)</label>
                    <span className="text-sm font-bold text-foreground">₹{budget}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value))}
                    disabled={loading}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>₹100</span>
                    <span>₹2000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Incoming Signals Toggle Button */}
            <button
              onClick={() => setShowSignals(!showSignals)}
              className="w-full bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-muted transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary rounded-lg border border-border">
                  <Settings className="text-muted-foreground" size={18} />
                </div>
                <div className="text-left">
                  <h3 className="text-foreground text-sm font-medium">Incoming Signals</h3>
                  <p className="text-xs text-muted-foreground">Wellness & Fitness Coach data</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${showSignals ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800' : 'bg-secondary text-muted-foreground border border-border'}`}>
                  {showSignals ? 'Enabled' : 'Disabled'}
                </span>
                {showSignals ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
              </div>
            </button>

            {/* Incoming Signals (Wellness & Fitness Coach) - Collapsible */}
            {showSignals && (
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="text-muted-foreground" size={20} />
                  <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Incoming Signals</h3>
                </div>
                <div className="space-y-4">
                  {/* Wellness Data */}
                  <h4 className="text-foreground text-sm font-medium flex items-center gap-2"><HeartPulse size={16} /> Wellness Manager</h4>
                  <div className="space-y-2 pl-2 border-l border-border">
                    <label className="text-xs font-medium text-muted-foreground block">Sleep Score (Last Night)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={sleepScore}
                      onChange={(e) => setSleepScore(parseInt(e.target.value))}
                      disabled={loading}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-border outline-none"
                    />
                    <label className="text-xs font-medium text-muted-foreground block mt-2">Stress Level</label>
                    <CustomSelect
                      value={stressLevel}
                      onChange={setStressLevel}
                      disabled={loading}
                      options={[
                        { value: 'Low', label: 'Low' },
                        { value: 'Moderate', label: 'Moderate' },
                        { value: 'High', label: 'High' }
                      ]}
                    />
                    <label className="text-xs font-medium text-muted-foreground block mt-2">Active Calories Burned</label>
                    <input
                      type="number"
                      min="0"
                      value={caloriesBurned}
                      onChange={(e) => setCaloriesBurned(parseInt(e.target.value))}
                      disabled={loading}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-border outline-none"
                    />
                  </div>

                  {/* Fitness Coach Plan */}
                  <h4 className="text-foreground text-sm font-medium mt-4 flex items-center gap-2"><Activity size={16} /> Fitness Coach</h4>
                  <div className="space-y-2 pl-2 border-l border-border">
                    <label className="text-xs font-medium text-muted-foreground block">Incoming Signal (Workout Context)</label>
                    <textarea
                      value={fitnessCoachPlan}
                      onChange={(e) => setFitnessCoachPlan(e.target.value)}
                      disabled={loading}
                      rows={4}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-border outline-none resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={startNutritionSession}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white transition-all ${loading ? 'bg-muted cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg'}`}
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
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-blue-950/50 text-blue-400 rounded-lg border border-blue-800">
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-foreground font-bold">NutriScan AI</h3>
                <p className="text-xs text-muted-foreground">Scan food for instant analysis</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${scanFile ? 'border-blue-600 bg-blue-950/20' : 'border-border hover:border-blue-600 hover:bg-secondary'}`}>
                {scanPreview ? (
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-4 shadow-sm">
                    <img src={scanPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setScanFile(null); setScanPreview(null); setScanResult(null); }}
                      className="absolute top-2 right-2 p-1 bg-card rounded-full shadow-md text-muted-foreground hover:text-red-400 border border-border"
                    >
                      <div className="w-4 h-4 flex items-center justify-center">×</div>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-blue-950/50 text-blue-400 rounded-full flex items-center justify-center mb-3 border border-blue-800">
                      <Target size={24} />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Click to upload image</p>
                    <p className="text-xs text-muted-foreground">Supports JPG, PNG</p>
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
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white transition-all ${loading || !scanFile ? 'bg-muted cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'}`}
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

      {/* Right Column: Meal Plan Results */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 flex items-center gap-3 text-red-400">
            <AlertTriangle size={20} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {mode === 'planner' ? (
          // Meal Planner Results (Existing)
          <div className="flex-1 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden min-h-[500px]">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Your Personalized Meal</h2>
                <p className="text-muted-foreground text-sm">AI-crafted based on your goals, wellness & workout</p>
              </div>
              {parsedPlan && (
                <div className="bg-emerald-950/50 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-800 flex items-center gap-1">
                  <CheckCircle size={14} />
                  PLAN READY
                </div>
              )}
            </div>

            {/* Content Area */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-60">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-border rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-muted-foreground font-mono text-sm">Consulting Nutritionist Agent...</p>
              </div>
            ) : parsedPlan ? (
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {/* Intro Card */}
                {parsedPlan.intro && (
                  <div className="bg-gradient-to-r from-indigo-950/50 via-purple-950/50 to-pink-950/50 rounded-xl p-4 border border-indigo-800">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Sparkles className="text-white" size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-indigo-300 mb-1">Personalized for You</p>
                        <p className="text-muted-foreground text-sm leading-relaxed">{parsedPlan.intro}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Collapsible Meal Sections */}
                <div className="space-y-4">
                  {parsedPlan.meals.breakfast && (
                    <CollapsibleMealSection
                      meal={parsedPlan.meals.breakfast}
                      mealType="breakfast"
                      dietType={dietType}
                      budget={budget}
                      defaultOpen={true}
                    />
                  )}
                  {parsedPlan.meals.lunch && (
                    <CollapsibleMealSection
                      meal={parsedPlan.meals.lunch}
                      mealType="lunch"
                      dietType={dietType}
                      budget={budget}
                    />
                  )}
                  {parsedPlan.meals.snacks && (
                    <CollapsibleMealSection
                      meal={parsedPlan.meals.snacks}
                      mealType="snacks"
                      dietType={dietType}
                      budget={budget}
                    />
                  )}
                  {parsedPlan.meals.dinner && (
                    <CollapsibleMealSection
                      meal={parsedPlan.meals.dinner}
                      mealType="dinner"
                      dietType={dietType}
                      budget={budget}
                    />
                  )}
                </div>

                {/* Protein Boosters Section */}
                {parsedPlan.proteinBoosters && parsedPlan.proteinBoosters.length > 0 && (
                  <div className="bg-gradient-to-r from-rose-950/40 to-pink-950/40 rounded-xl p-5 border border-rose-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center">
                        <Flame className="text-white" size={20} />
                      </div>
                      <div>
                        <h4 className="text-rose-300 font-bold">⚡ Protein Boosters</h4>
                        <p className="text-xs text-muted-foreground">
                          Target: {parsedPlan.proteinTarget}g | Current: {parsedPlan.totalMacros.protein}g
                          <span className="text-rose-400 ml-2">(Gap: {Math.max(0, parsedPlan.proteinTarget - parsedPlan.totalMacros.protein)}g)</span>
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {parsedPlan.proteinBoosters.map((booster, idx) => (
                        <div key={idx} className="bg-card/50 rounded-lg p-4 border border-rose-900/50">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-bold text-foreground">{booster.name}</h5>
                              <p className="text-xs text-rose-400">+{booster.protein}g protein</p>
                            </div>
                            <span className="text-sm font-bold text-emerald-400">₹{booster.price}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">{booster.description}</p>
                          <a
                            href={booster.blinkit}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black rounded-lg text-xs font-bold transition-all"
                          >
                            <ShoppingCart size={14} />
                            <span>Order on Blinkit</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total Daily Cost */}
                {parsedPlan.totalDailyCost > 0 && (
                  <div className="flex items-center justify-between bg-secondary rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-900/50 rounded-lg flex items-center justify-center border border-emerald-800">
                        <IndianRupee className="text-emerald-400" size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Total Daily Cost</p>
                        <p className="text-2xl font-bold text-foreground">₹{parsedPlan.totalDailyCost}</p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Daily Budget: ₹{budget}
                    </div>
                  </div>
                )}

                {/* Total Daily Macros Grid */}
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                    <Dumbbell size={14} />
                    Total Daily Nutrition
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <NutrientPill
                      label="Protein"
                      value={parsedPlan.totalMacros.protein}
                      unit="g"
                      color="bg-emerald-900/50"
                      icon={<Flame className="text-emerald-400" size={18} />}
                    />
                    <NutrientPill
                      label="Carbs"
                      value={parsedPlan.totalMacros.carbs}
                      unit="g"
                      color="bg-blue-900/50"
                      icon={<Target className="text-blue-400" size={18} />}
                    />
                    <NutrientPill
                      label="Fat"
                      value={parsedPlan.totalMacros.fat}
                      unit="g"
                      color="bg-amber-900/50"
                      icon={<TrendingDown className="text-amber-400" size={18} />}
                    />
                    <NutrientPill
                      label="Calories"
                      value={parsedPlan.totalMacros.calories}
                      unit=""
                      color="bg-purple-900/50"
                      icon={<Sparkles className="text-purple-400" size={18} />}
                    />
                  </div>
                </div>

                {/* Why It Works */}
                {parsedPlan.whyItWorks && (
                  <div className="bg-emerald-950/30 rounded-xl p-4 border border-emerald-800">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="text-white" size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-400 mb-1">Why This Plan Works</p>
                        <p className="text-muted-foreground text-sm leading-relaxed">{parsedPlan.whyItWorks}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : mealResult ? (
              // Fallback: If parsing fails, show formatted text
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed text-sm bg-secondary p-6 rounded-lg border border-border">
                    {mealResult}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
                <div className="relative">
                  <div className="w-24 h-24 bg-secondary rounded-2xl flex items-center justify-center border border-border">
                    <Utensils size={40} className="text-muted-foreground opacity-50" />
                  </div>
                </div>
                <p className="text-sm font-medium">Configure your preferences and generate a plan</p>
                <p className="text-xs text-muted-foreground">Your personalized meal will appear here</p>
              </div>
            )}
          </div>
        ) : (
          // Scanner Mode Results
          <div className="flex-1 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden min-h-[500px]">
            <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">NutriScan Analysis</h2>
                <p className="text-muted-foreground text-sm">Visual analysis via Gemini Vision</p>
              </div>
              {scanResult && (
                <div className="bg-blue-950/50 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-800 flex items-center gap-1">
                  <Target size={14} />
                  ANALYSIS COMPLETE
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-60">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-border rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-muted-foreground font-mono text-sm">Scanning image contents...</p>
              </div>
            ) : scanResult ? (
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {/* Product Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{scanResult.brandName}</p>
                    <h3 className="text-3xl font-bold text-foreground">{scanResult.productName}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-1 bg-secondary rounded text-xs font-medium text-muted-foreground border border-border">{scanResult.processingLabel}</span>
                      {scanResult.isExpired && <span className="px-2 py-1 bg-red-950/50 text-red-400 rounded text-xs font-bold border border-red-800">⚠️ EXPIRED</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-bold ${scanResult.healthScore >= 70 ? 'text-emerald-400' : scanResult.healthScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                      {scanResult.healthScore}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Health Score</p>
                  </div>
                </div>

                {/* Nutrition Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-secondary p-3 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Calories</p>
                    <p className="text-xl font-bold text-foreground">{scanResult.nutrition.calories}</p>
                  </div>
                  <div className="bg-secondary p-3 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Protein</p>
                    <p className="text-xl font-bold text-foreground">{scanResult.nutrition.protein}g</p>
                  </div>
                  <div className="bg-secondary p-3 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Carbs</p>
                    <p className="text-xl font-bold text-foreground">{scanResult.nutrition.carbs}g</p>
                  </div>
                  <div className="bg-secondary p-3 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Sugar</p>
                    <p className="text-xl font-bold text-foreground">{scanResult.nutrition.sugar}g</p>
                  </div>
                </div>

                {/* Warnings */}
                {scanResult.warnings.length > 0 && (
                  <div className="bg-red-950/30 border border-red-800 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Health Warnings
                    </h4>
                    <ul className="list-disc list-inside text-sm text-red-400/80 space-y-1">
                      {scanResult.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ingredients */}
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-3">Ingredient Analysis</h4>
                  <div className="space-y-2">
                    {scanResult.ingredients.map((ing: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg hover:border-muted transition-all">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${ing.riskLevel === 'High' ? 'bg-red-500' : ing.riskLevel === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{ing.name}</p>
                          <p className="text-xs text-muted-foreground">{ing.description}</p>
                        </div>
                        <span className="ml-auto text-xs font-mono bg-secondary px-2 py-1 rounded border border-border">{ing.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alternatives */}
                {scanResult.alternatives.length > 0 && (
                  <div className="bg-emerald-950/30 border border-emerald-800 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                      <Leaf size={16} />
                      Healthier Alternatives
                    </h4>
                    <div className="space-y-2">
                      {scanResult.alternatives.map((alt: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-2 bg-card/50 rounded-lg border border-border">
                          <span className="font-bold text-emerald-400">{alt.name}</span>
                          <span className="text-xs text-emerald-400/80">{alt.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
                <div className="p-4 bg-blue-950/30 text-blue-400/50 rounded-full border border-blue-800">
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
