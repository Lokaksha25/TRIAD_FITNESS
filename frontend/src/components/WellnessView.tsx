
import React, { useState, useEffect } from 'react';
import {
    Heart,
    Moon,
    Activity,
    Brain,
    Save,
    CheckCircle,
    RotateCcw,
    AlertTriangle,
    Watch,
    Smartphone,
    DownloadCloud,
    Loader2,
    TrendingUp,
    Upload,
    FileJson
} from 'lucide-react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import './WellnessView.css';

const WellnessView: React.FC = () => {
    const { currentUser } = useAuth();

    // biometric state
    const [sleep, setSleep] = useState<number>(7.0);
    const [hrv, setHrv] = useState<number>(50);
    const [rhr, setRhr] = useState<number>(65);

    const [loading, setLoading] = useState<boolean>(false);
    const [saved, setSaved] = useState<boolean>(false);
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [importStep, setImportStep] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // AI Analysis State (only for wearable import)
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);

    // Load initial data on mount
    useEffect(() => {
        if (currentUser) {
            fetchWellnessData();
        }
    }, [currentUser]);

    const fetchWellnessData = async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`/api/wellness/data?user_id=${currentUser.uid}`);
            const json = await response.json();

            if (json.status === 'success' && json.data.found) {
                const data = json.data;
                setSleep(data.sleep_hours);
                setHrv(data.hrv);
                setRhr(data.rhr);
            }
        } catch (err) {
            console.error("Failed to fetch wellness data", err);
        }
    };

    const calculateReadiness = () => {
        let score = 70;
        if (sleep > 7.5) score += 10;
        if (sleep < 6) score -= 15;
        if (hrv > 65) score += 10;
        if (hrv < 40) score -= 15;
        if (rhr < 60) score += 10;
        if (rhr > 75) score -= 10;
        return Math.min(100, Math.max(0, score));
    };

    const readinessColor = (score: number) => {
        if (score >= 80) return "text-emerald-400";
        if (score >= 60) return "text-yellow-400";
        return "text-rose-500";
    };

    const readinessBg = (score: number) => {
        if (score >= 80) return "bg-emerald-500/20 border-emerald-500/50";
        if (score >= 60) return "bg-yellow-500/20 border-yellow-500/50";
        return "bg-rose-500/20 border-rose-500/50";
    };

    // --- Chart Data Generators ---
    const getRadarData = () => {
        // Normalize values to 0-100 scale for radar chart
        const normSleep = Math.min(100, (sleep / 9) * 100);
        const normHrv = Math.min(100, (hrv / 100) * 100);
        const normRhr = Math.min(100, Math.max(0, 100 - ((rhr - 40) / 60 * 100))); // Inverted: lower is better

        return [
            { subject: 'Sleep', A: normSleep, fullMark: 100 },
            { subject: 'HRV', A: normHrv, fullMark: 100 },
            { subject: 'Recovery', A: normRhr, fullMark: 100 },
        ];
    };

    // Simulate a trend based on current slider values
    const getTrendData = () => {
        const currentScore = calculateReadiness();
        const data = [];
        for (let i = 6; i >= 0; i--) {
            // Generate some random variance for past days, trending towards current
            const variance = Math.random() * 15 - 7.5;
            const dayScore = Math.min(100, Math.max(0, currentScore + (i * variance * 0.5)));
            const date = new Date();
            date.setDate(date.getDate() - i);
            data.push({
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                score: Math.round(dayScore)
            });
        }
        return data;
    };

    // --- Actions ---

    const handleSave = async () => {
        if (!currentUser) return;

        setLoading(true);
        setSaved(false);
        setSuccessMessage(null);

        try {
            const payload = {
                user_id: currentUser.uid,
                date: new Date().toISOString().split('T')[0],
                sleep_hours: sleep,
                hrv: Math.round(hrv),
                rhr: Math.round(rhr)
            };

            const response = await fetch('/api/wellness/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.status === 'success') {
                setSaved(true);
                setSuccessMessage("Biometric data saved to Pinecone! Dashboard updated.");
                setTimeout(() => setSuccessMessage(null), 3000);

                // Invalidate dashboard cache to trigger refresh with new data
                localStorage.removeItem(`dashboard_cache_${currentUser.uid}`);
                localStorage.removeItem(`dashboard_cache_ts_${currentUser.uid}`);
                console.log('🔄 Dashboard cache invalidated');
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to server.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !currentUser) return;

        setIsImporting(true);
        setAiAnalysis(null);
        setImportStep('Reading Data...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const jsonData = JSON.parse(text);

                if (!Array.isArray(jsonData)) {
                    throw new Error("Invalid format: Expected a list of daily records.");
                }

                setImportStep('Analyzing 3-Day Trend...');

                const response = await fetch('/api/wellness/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: currentUser.uid,
                        data: jsonData
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    // Update UI with the LATEST record returned
                    const latest = result.latest_record;
                    setSleep(latest.sleep_hours);
                    setHrv(latest.hrv);
                    setRhr(latest.rhr);

                    setAiAnalysis(result.analysis);
                    setSuccessMessage("Multi-day trend analyzed successfully!");
                    setTimeout(() => setSuccessMessage(null), 4000);

                    // Invalidate dashboard cache to trigger refresh with new data
                    localStorage.removeItem(`dashboard_cache_${currentUser.uid}`);
                    localStorage.removeItem(`dashboard_cache_ts_${currentUser.uid}`);
                    console.log('🔄 Dashboard cache invalidated after upload');
                } else {
                    throw new Error(result.detail || "Upload failed");
                }

            } catch (err: any) {
                console.error("Upload failed", err);
                alert(`Upload failed: ${err.message}`);
            } finally {
                setIsImporting(false);
                setImportStep('');
                // Reset input
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const score = calculateReadiness();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in relative z-10">

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-gray-800 pb-8">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
                        <Activity className="w-10 h-10 text-emerald-400" />
                        Wellness Command Center
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Advanced biometric tracking and AI-powered recovery analysis.
                    </p>
                </div>

                <div className="flex flex-col gap-2 items-end">
                    <button
                        onClick={() => document.getElementById('wearable-upload')?.click()}
                        disabled={isImporting}
                        className={`flex items-center gap-3 px-6 py-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-emerald-500/50 rounded-2xl transition-all shadow-lg group cursor-pointer ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="relative">
                            <Upload className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                            {isImporting && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />}
                        </div>
                        <div className="text-left">
                            <span className="block text-xs text-gray-400 uppercase tracking-wide font-bold">Smart Sync</span>
                            <span className="block text-sm text-white font-medium">
                                {isImporting ? 'Analyzing Trend...' : 'Upload Wearable Data'}
                            </span>
                        </div>
                        {isImporting ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : <DownloadCloud className="w-5 h-5 text-gray-500 group-hover:text-white" />}
                    </button>

                    <input
                        id="wearable-upload"
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isImporting}
                    />

                    <a href="/sample_wearable_data.json" download className="text-xs text-gray-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                        <FileJson className="w-3 h-3" /> Download Sample Data
                    </a>
                </div>
            </header>

            {/* Import Overlay */}
            {isImporting && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-gray-900 border border-gray-700 p-8 rounded-3xl text-center max-w-sm w-full animate-slide-up shadow-2xl">
                        <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                            <Smartphone className="w-10 h-10 text-cyan-400" />
                            <div className="absolute inset-0 border-4 border-emerald-500/30 rounded-full animate-ping"></div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{importStep}</h3>
                        <p className="text-gray-400 text-sm">Please keep your device in range...</p>
                    </div>
                </div>
            )}

            {/* Success Message Toast */}
            {successMessage && (
                <div className="fixed top-24 right-6 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-slide-up z-50">
                    <CheckCircle className="w-5 h-5" />
                    {successMessage}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LEFT: Inputs & Simulator */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-gray-900/50 backdrop-blur-md rounded-3xl p-8 border border-gray-800 shadow-xl">

                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
                            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-cyan-400" /> Biometric Simulator
                            </h3>
                            <div className={`px-4 py-1.5 rounded-full border text-sm font-bold flex items-center gap-2 ${readinessBg(score)} ${readinessColor(score)}`}>
                                {score >= 80 ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                Readiness: {score}/100
                            </div>
                        </div>

                        {/* Sliders */}
                        <div className="space-y-8">
                            {/* Sleep */}
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <label className="text-gray-300 flex items-center gap-2 font-medium">
                                        <Moon className="w-4 h-4 text-purple-400" /> Sleep Duration
                                    </label>
                                    <span className="text-purple-300 font-mono text-xl font-bold">{sleep} h</span>
                                </div>
                                <input
                                    type="range"
                                    min="3" max="12" step="0.5"
                                    value={sleep}
                                    onChange={(e) => setSleep(parseFloat(e.target.value))}
                                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
                                />
                            </div>

                            {/* HRV */}
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <label className="text-gray-300 flex items-center gap-2 font-medium">
                                        <Activity className="w-4 h-4 text-emerald-400" /> HRV (Variability)
                                    </label>
                                    <span className="text-emerald-300 font-mono text-xl font-bold">{hrv} ms</span>
                                </div>
                                <input
                                    type="range"
                                    min="20" max="150" step="1"
                                    value={hrv}
                                    onChange={(e) => setHrv(parseInt(e.target.value))}
                                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                                />
                            </div>

                            {/* RHR */}
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <label className="text-gray-300 flex items-center gap-2 font-medium">
                                        <Heart className="w-4 h-4 text-rose-400" /> Resting Heart Rate
                                    </label>
                                    <span className="text-rose-300 font-mono text-xl font-bold">{rhr} bpm</span>
                                </div>
                                <input
                                    type="range"
                                    min="40" max="100" step="1"
                                    value={rhr}
                                    onChange={(e) => setRhr(parseInt(e.target.value))}
                                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:accent-rose-400 transition-all"
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4 pt-8 mt-8 border-t border-gray-800">
                            <button
                                onClick={() => { setSleep(7.0); setHrv(50); setRhr(65); }}
                                className="px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition bg-gray-800 hover:bg-gray-700 text-gray-300 flex-1"
                            >
                                <RotateCcw className="w-4 h-4" /> Reset
                            </button>

                            <button
                                onClick={handleSave}
                                disabled={loading || isImporting}
                                className={`
                                    px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition flex-[2]
                                    ${loading
                                        ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                                        : saved
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/20'}
                                `}
                            >
                                {loading ? 'Processing...' : saved ? 'Data Saved' : 'Save to Cloud'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Visualizations & AI Results */}
                <div className="lg:col-span-7 space-y-6">

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Radar Chart: Balance */}
                        <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-6 h-80 flex flex-col">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Recovery Balance
                            </h4>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRadarData()}>
                                        <PolarGrid stroke="#374151" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar
                                            name="Wellness"
                                            dataKey="A"
                                            stroke="#10b981"
                                            strokeWidth={2}
                                            fill="#10b981"
                                            fillOpacity={0.3}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Trend Chart: Readiness */}
                        <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-6 h-80 flex flex-col">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> 7-Day Trend
                            </h4>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={getTrendData()}>
                                        <defs>
                                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                        <XAxis dataKey="day" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="score"
                                            stroke="#06b6d4"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorScore)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis Result (Visible only after Wearable Import) */}
                    {aiAnalysis && (
                        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-3xl p-8 animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Brain className="w-40 h-40 text-white" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
                                        AI Wearable Analysis
                                    </div>
                                    <div className="h-px bg-indigo-500/30 flex-1"></div>
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-4">
                                    "{aiAnalysis.executive_summary}"
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    <div className="bg-gray-900/50 rounded-2xl p-5 border-l-4 border-emerald-500">
                                        <h4 className="text-emerald-400 font-bold text-xs uppercase mb-2">Training Protocol</h4>
                                        <p className="text-gray-300">{aiAnalysis.training_protocol}</p>
                                    </div>
                                    <div className="bg-gray-900/50 rounded-2xl p-5 border-l-4 border-cyan-500">
                                        <h4 className="text-cyan-400 font-bold text-xs uppercase mb-2">Micro Intervention</h4>
                                        <p className="text-gray-300">{aiAnalysis.micro_intervention}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default WellnessView;
