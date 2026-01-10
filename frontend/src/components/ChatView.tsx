import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Dumbbell, Utensils, Sun, ShieldCheck, User, Bot, Sparkles } from 'lucide-react';
import { AgentType, ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext';

const ChatView: React.FC = () => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'init',
            sender: 'system',
            text: 'Welcome to Triad Fitness. Describe your current status or goal to begin analysis.',
            timestamp: new Date()
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingStep, setLoadingStep] = useState<'analyzing' | 'reviewing' | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loadingStep]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || isProcessing) return;

        const userText = inputText;
        setInputText('');
        setIsProcessing(true);
        setLoadingStep('analyzing');

        // 1. User Message
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: userText,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);

        try {
            // 2. Fetch Real Agent Data (All Agents from Backend)
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userText,
                    user_id: currentUser?.uid || "user_123" // Fallback only if auth fails unexpectedly
                })
            });

            if (!response.ok) throw new Error("API Call Failed");

            const data = await response.json();

            // Map backend response to frontend format
            // Backend returns: { agents: [{agentType, content, summary}, ...], manager_decision }
            const agentResponses = data.agents.map((agent: any) => ({
                agentType: agent.agentType as AgentType,
                content: agent.content,
                summary: agent.summary
            }));

            // Store manager decision from response (real AI-generated)
            const managerDecision = data.manager_decision || "Plan synthesized based on current wellness and goals.";

            const agentMsg: ChatMessage = {
                id: 'agents-' + Date.now(),
                sender: 'agents',
                agentResponses: agentResponses,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, agentMsg]);
            setLoadingStep('reviewing');

            // 3. Manager Decision (Real AI-powered from backend)
            setTimeout(() => {
                const managerMsg: ChatMessage = {
                    id: 'manager-' + Date.now(),
                    sender: 'manager',
                    text: managerDecision,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, managerMsg]);
                setLoadingStep(null);
                setIsProcessing(false);
            }, 1500);

        } catch (err) {
            console.error("Chat API Error:", err);

            // Error state: Show connection errors for all agents
            const errorResponses = [
                {
                    agentType: AgentType.TRAINER,
                    content: "Unable to connect to Physical Trainer. Please ensure the backend server is running.",
                    summary: "Connection Error"
                },
                {
                    agentType: AgentType.NUTRITIONIST,
                    content: "Unable to connect to Nutritionist. Please ensure the backend server is running.",
                    summary: "Connection Error"
                },
                {
                    agentType: AgentType.WELLNESS,
                    content: "Unable to connect to Wellness Coach. Please ensure the backend server is running.",
                    summary: "Connection Error"
                }
            ];

            const agentMsg: ChatMessage = {
                id: 'agents-' + Date.now(),
                sender: 'agents',
                agentResponses: errorResponses,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, agentMsg]);
            setLoadingStep('reviewing');

            // Show error manager decision
            setTimeout(() => {
                const managerMsg: ChatMessage = {
                    id: 'manager-' + Date.now(),
                    sender: 'manager',
                    text: "Unable to generate unified plan. Please check backend connection.",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, managerMsg]);
                setLoadingStep(null);
                setIsProcessing(false);
            }, 1500);
        }
    };

    const getAgentIcon = (type: AgentType) => {
        switch (type) {
            case AgentType.TRAINER: return <Dumbbell size={20} className="text-slate-400" />;
            case AgentType.NUTRITIONIST: return <Utensils size={20} className="text-emerald-400" />;
            case AgentType.WELLNESS: return <Sun size={20} className="text-amber-400" />;
            case AgentType.MANAGER: return <ShieldCheck size={24} className="text-zinc-100" />;
            default: return <Bot size={20} />;
        }
    };

    const getAgentStyles = (type: AgentType) => {
        switch (type) {
            case AgentType.TRAINER: return 'border-slate-700 bg-slate-900/50';
            case AgentType.NUTRITIONIST: return 'border-emerald-800 bg-emerald-950/50';
            case AgentType.WELLNESS: return 'border-amber-800 bg-amber-950/50';
            default: return 'border-border bg-card';
        }
    };

    // Sort order: Trainer, Nutritionist, Wellness
    const sortAgents = (agents: { agentType: AgentType; content: string; summary: string }[]) => {
        const order = [AgentType.TRAINER, AgentType.NUTRITIONIST, AgentType.WELLNESS];
        return [...agents].sort((a, b) => order.indexOf(a.agentType) - order.indexOf(b.agentType));
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-4 text-center border-b border-border pb-2">
                <h2 className="text-lg font-bold text-foreground">Consultation Room</h2>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-6 px-4 pb-4 scrollbar-hide">
                {messages.map((msg) => (
                    <div key={msg.id} className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">

                        {/* User Message */}
                        {msg.sender === 'user' && (
                            <div className="flex justify-end mb-2">
                                <div className="flex items-start space-x-3 max-w-[85%] flex-row-reverse space-x-reverse">
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 shadow-sm border border-border">
                                        <User size={16} className="text-foreground" />
                                    </div>
                                    <div className="bg-card border border-border rounded-2xl rounded-tr-none px-5 py-3 shadow-sm">
                                        <p className="text-foreground leading-relaxed text-sm md:text-base">{msg.text}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* System Message (Welcome / Static Info) */}
                        {msg.sender === 'system' && (
                            <div className="flex justify-start my-4 max-w-[90%]">
                                {msg.id === 'init' ? (
                                    <div className="flex items-start space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                                            <Bot size={18} className="text-muted-foreground" />
                                        </div>
                                        <div className="bg-card text-muted-foreground text-sm px-5 py-3 rounded-2xl rounded-tl-none border border-border shadow-sm">
                                            {msg.text}
                                        </div>
                                    </div>
                                ) : (
                                    // Fallback for any non-init system messages
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                                            <Sparkles size={16} className="text-muted-foreground" />
                                        </div>
                                        <span className="text-muted-foreground text-sm">{msg.text}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Agent Responses (Vertical Stack) */}
                        {msg.sender === 'agents' && msg.agentResponses && (
                            <div className="flex flex-col space-y-3 mt-1 max-w-[90%] md:max-w-[75%]">
                                {sortAgents(msg.agentResponses).map((agent, idx) => (
                                    <div key={idx} className={`rounded-xl border p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start ${getAgentStyles(agent.agentType)}`}>
                                        {/* Avatar / Icon Left */}
                                        <div className="shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center shadow-sm">
                                                {getAgentIcon(agent.agentType)}
                                            </div>
                                        </div>

                                        {/* Content Right */}
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-foreground mb-1">{agent.agentType}</h4>
                                            <div className="text-sm text-muted-foreground leading-relaxed mb-3 prose prose-invert prose-sm max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{agent.content}</ReactMarkdown>
                                            </div>
                                            <div className="pt-2 border-t border-border">
                                                <p className="text-xs font-bold text-foreground">
                                                    {agent.summary}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Manager Decision (Vertical Stack Item) */}
                        {msg.sender === 'manager' && (
                            <div className="flex flex-col mt-3 max-w-[90%] md:max-w-[75%]">
                                {/* Manager Card - Darker, Neutral */}
                                <div className="bg-card rounded-xl p-5 shadow-md text-foreground flex flex-col md:flex-row gap-4 items-start border border-violet-800">
                                    {/* Avatar / Icon Left */}
                                    <div className="shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-violet-950 border border-violet-700 flex items-center justify-center shadow-sm">
                                            <ShieldCheck size={20} className="text-violet-300" />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="font-bold text-base mb-1 text-foreground">Manager Agent <span className="text-muted-foreground font-normal text-sm">- Final Decision</span></h3>
                                        <div className="text-muted-foreground text-sm leading-relaxed mb-3 prose prose-invert prose-sm max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                        </div>
                                        <div className="inline-flex items-center space-x-2 bg-secondary px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-border">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                            <span>PROTOCOL_RESOLVED</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                ))}

                {/* Transient Loading Indicators */}
                {loadingStep === 'analyzing' && (
                    <div className="flex justify-start my-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 shadow-sm">
                                <Loader2 size={16} className="text-muted-foreground animate-spin" />
                            </div>
                            <span className="text-muted-foreground text-xs uppercase tracking-widest font-semibold bg-card px-3 py-1.5 rounded-full border border-border shadow-sm">
                                Consulting Physical Trainer, Nutritionist, and Wellness Coach...
                            </span>
                        </div>
                    </div>
                )}

                {loadingStep === 'reviewing' && (
                    <div className="flex justify-start my-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center space-x-3 ml-1">
                            <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-0"></div>
                            <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-150"></div>
                            <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-300"></div>
                            <span className="text-muted-foreground text-xs font-medium ml-2">Manager Reviewing...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="mt-2 px-4 pb-6 pt-2 bg-background">
                <form onSubmit={handleSend} className="relative max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={isProcessing}
                        placeholder={isProcessing ? "Analysis in progress..." : "Type your update (e.g., 'Knee feels unstable')"}
                        className="w-full bg-card border border-border text-foreground rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-border focus:border-border shadow-sm placeholder:text-muted-foreground transition-all text-base"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || isProcessing}
                        className="absolute right-2 top-2 p-2.5 bg-secondary text-foreground rounded-xl hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatView;
