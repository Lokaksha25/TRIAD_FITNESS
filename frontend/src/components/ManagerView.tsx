import React from 'react';
import { ACTIVE_CONFLICT } from '../constants';
import { ArrowRight, CheckCircle2, Scale } from 'lucide-react';

const ManagerView: React.FC = () => {
    const [conflict, setConflict] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetchConflict();
    }, []);

    const fetchConflict = async () => {
        try {
            const res = await fetch('/api/manager/conflicts');
            const data = await res.json();
            setConflict(data);
        } catch (e) {
            console.error("Failed to fetch conflicts", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-6 text-stone-400">Loading Manager status...</div>;
    if (!conflict) return <div className="p-6 text-stone-400">System Nominal. No active conflicts.</div>;

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Banner */}
            <div className="bg-stone-100 border border-stone-200 rounded-xl p-6 flex items-center space-x-6 shadow-sm">
                <div className="bg-white p-4 rounded-full border border-stone-200">
                    <Scale className="text-stone-700" size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-stone-900">Conflict Resolution Engine</h2>
                    <p className="text-stone-500">Mediating diverging protocols between specialized agents to optimize user safety and goal adherence.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1">
                {/* Column 1: Inputs (The Conflict) */}
                <div className="xl:col-span-4 space-y-4">
                    <h3 className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-red-600 mr-2"></span>
                        Conflicting Inputs
                    </h3>
                    {conflict.sources.map((source: any, idx: number) => (
                        <div key={idx} className="bg-white border border-stone-200 p-5 rounded-lg relative overflow-hidden group hover:border-stone-300 transition-all shadow-sm">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${source.priority === 'High' ? 'bg-red-600' : 'bg-amber-500'
                                }`}></div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-stone-500 uppercase">{source.agent}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${source.priority === 'High'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>{source.priority} Priority</span>
                            </div>
                            <p className="text-stone-800 text-sm font-medium leading-relaxed">"{source.recommendation}"</p>
                        </div>
                    ))}
                </div>

                {/* Column 2: The Logic (Arrow / Process) */}
                <div className="xl:col-span-1 flex flex-col items-center justify-center py-4 xl:py-0">
                    <div className="h-full w-0.5 bg-stone-200 hidden xl:block relative">
                        <div className="absolute top-1/2 -translate-y-1/2 -left-3 bg-white p-2 rounded-full border border-stone-300 shadow-sm">
                            <ArrowRight className="text-stone-400" />
                        </div>
                    </div>
                    <ArrowRight className="text-stone-400 xl:hidden rotate-90 my-4" />
                </div>

                {/* Column 3: Decision (The Output) */}
                <div className="xl:col-span-7 bg-white border border-stone-200 rounded-xl p-8 flex flex-col shadow-sm">
                    <h3 className="text-emerald-700 text-xs font-bold uppercase tracking-wider mb-6 flex items-center">
                        <CheckCircle2 size={16} className="mr-2" />
                        Final Determination
                    </h3>

                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-stone-900 mb-4 leading-tight">
                            {conflict.resolution.decision}
                        </h1>
                        <p className="text-stone-600 text-lg leading-relaxed">
                            {conflict.resolution.reasoning}
                        </p>
                    </div>

                    <div className="bg-stone-50 rounded-xl p-6 border border-stone-200 mt-auto">
                        <h4 className="text-stone-500 text-xs font-bold uppercase mb-4">Protocol Updates Executed</h4>
                        <ul className="space-y-3">
                            {conflict.resolution.impact.map((impact: string, idx: number) => (
                                <li key={idx} className="flex items-center space-x-3 text-sm text-stone-700">
                                    <ArrowRight size={14} className="text-stone-400" />
                                    <span>{impact}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerView;