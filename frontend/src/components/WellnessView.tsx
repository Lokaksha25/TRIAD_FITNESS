import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Heart, Moon, BatteryWarning } from 'lucide-react';

const hrvData = [
    { time: '00:00', value: 45 },
    { time: '02:00', value: 42 },
    { time: '04:00', value: 38 },
    { time: '06:00', value: 35 },
    { time: '08:00', value: 32 },
];

const sleepData = [
    { day: 'Mon', hours: 7.5 },
    { day: 'Tue', hours: 6.8 },
    { day: 'Wed', hours: 7.2 },
    { day: 'Thu', hours: 4.2 }, // Today
];

const WellnessView: React.FC = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Metric Cards - Compact Design */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-muted-foreground text-xs mb-0.5">HRV (rMSSD)</p>
                        <p className="text-2xl font-bold text-foreground">32<span className="text-xs text-muted-foreground font-normal ml-1">ms</span></p>
                    </div>
                    <div className="bg-red-950/50 p-2.5 rounded-lg border border-red-800">
                        <Heart className="text-red-400" size={20} />
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Sleep Duration</p>
                        <p className="text-2xl font-bold text-amber-400">4h 12m</p>
                    </div>
                    <div className="bg-amber-950/50 p-2.5 rounded-lg border border-amber-800">
                        <Moon className="text-amber-400" size={20} />
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center space-x-3">
                    <BatteryWarning className="text-muted-foreground shrink-0" size={24} />
                    <div>
                        <h3 className="text-foreground font-bold text-xs uppercase">Insight Generated</h3>
                        <p className="text-muted-foreground text-xs leading-snug mt-0.5">
                            CNS fatigue indicated. Recovery compromised by acute sleep deprivation.
                        </p>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-foreground font-bold mb-6">Heart Rate Variability Trend (Last 8h)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hrvData}>
                            <defs>
                                <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(0 0% 8%)', borderColor: 'hsl(0 0% 18%)', color: 'hsl(0 0% 98%)' }}
                            />
                            <Area type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#colorHrv)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-red-400 mt-2 text-center bg-red-950/30 py-1 rounded border border-red-900">Downward trend indicates accumulating stress.</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-foreground font-bold mb-6">Sleep History (Last 4 Days)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sleepData}>
                            <XAxis dataKey="day" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: 'hsl(0 0% 12%)' }}
                                contentStyle={{ backgroundColor: 'hsl(0 0% 8%)', borderColor: 'hsl(0 0% 18%)', color: 'hsl(0 0% 98%)' }}
                            />
                            <Bar dataKey="hours" fill="#d97706" radius={[4, 4, 0, 0]} barSize={40}>
                                {sleepData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.hours < 6 ? '#d97706' : '#047857'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-amber-400 mt-2 text-center bg-amber-950/30 py-1 rounded border border-amber-900">Significant drop detected today.</p>
            </div>
        </div>
    );
};

export default WellnessView;
