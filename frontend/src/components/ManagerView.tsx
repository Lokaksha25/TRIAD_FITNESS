import React from 'react';
import { ArrowRight, CheckCircle2, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ManagerView: React.FC = () => {
    const { currentUser } = useAuth();
    const [conflict, setConflict] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (currentUser) {
            fetchConflict();
        }
    }, [currentUser]);

    const fetchConflict = async () => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`/api/manager/conflicts?user_id=${currentUser.uid}`);
            const data = await res.json();
            setConflict(data);
        } catch (e) {
            console.error("Failed to fetch manager briefing", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-6 text-muted-foreground">Loading Manager status...</div>;
    if (!conflict) return <div className="p-6 text-muted-foreground">System Nominal. No active conflicts.</div>;

    return (
        <div className="h-full flex flex-col space-y-6 animate-fade-in">
            {/* Banner */}
            <div className="bg-card border border-border rounded-xl p-6 flex items-center space-x-6 shadow-sm">
                <div className="bg-secondary p-4 rounded-full border border-border">
                    <Scale className="text-foreground" size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Conflict Resolution Engine</h2>
                    <p className="text-muted-foreground">Mediating diverging protocols between specialized agents to optimize user safety and goal adherence.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1">
                {/* Column 1: Inputs (The Conflict) */}
                <div className="xl:col-span-4 space-y-4">
                    <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                        Conflicting Inputs
                    </h3>
                    {conflict.sources.map((source: any, idx: number) => (
                        <div key={idx} className="bg-card border border-border p-5 rounded-lg relative overflow-hidden group hover:border-muted transition-all shadow-sm">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${source.priority === 'High' ? 'bg-red-500' : 'bg-amber-500'
                                }`}></div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-muted-foreground uppercase">{source.agent}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${source.priority === 'High'
                                    ? 'bg-red-950/50 text-red-400 border-red-800'
                                    : 'bg-amber-950/50 text-amber-400 border-amber-800'
                                    }`}>{source.priority} Priority</span>
                            </div>
                            <p className="text-foreground text-sm font-medium leading-relaxed">"{source.recommendation}"</p>
                        </div>
                    ))}
                </div>

                {/* Column 2: The Logic (Arrow / Process) */}
                <div className="xl:col-span-1 flex flex-col items-center justify-center py-4 xl:py-0">
                    <div className="h-full w-0.5 bg-border hidden xl:block relative">
                        <div className="absolute top-1/2 -translate-y-1/2 -left-3 bg-card p-2 rounded-full border border-border shadow-sm">
                            <ArrowRight className="text-muted-foreground" />
                        </div>
                    </div>
                    <ArrowRight className="text-muted-foreground xl:hidden rotate-90 my-4" />
                </div>

                {/* Column 3: Decision (The Output) */}
                <div className="xl:col-span-7 bg-card border border-border rounded-xl p-8 flex flex-col shadow-sm">
                    <h3 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6 flex items-center">
                        <CheckCircle2 size={16} className="mr-2" />
                        Final Determination
                    </h3>

                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-foreground mb-4 leading-tight">
                            {conflict.resolution.decision}
                        </h1>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            {conflict.resolution.reasoning}
                        </p>
                    </div>

                    <div className="bg-secondary rounded-xl p-6 border border-border mt-auto">
                        <h4 className="text-muted-foreground text-xs font-bold uppercase mb-4">Protocol Updates Executed</h4>
                        <ul className="space-y-3">
                            {conflict.resolution.impact.map((impact: string, idx: number) => (
                                <li key={idx} className="flex items-center space-x-3 text-sm text-foreground">
                                    <ArrowRight size={14} className="text-muted-foreground" />
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
