import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Dumbbell, Utensils, Sun, ShieldCheck, User, Bot, Sparkles } from 'lucide-react';
import { AgentType, ChatMessage } from '../types';
import { MOCK_MANAGER_DECISION } from '../constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ChatView: React.FC = () => {
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
                body: JSON.stringify({ message: userText })
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

            const agentMsg: ChatMessage = {
                id: 'agents-' + Date.now(),
                sender: 'agents',
                agentResponses: agentResponses,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, agentMsg]);
            setLoadingStep('reviewing');

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
        }

        // 3. Manager Decision (Simulated for now)
        setTimeout(() => {
            const managerMsg: ChatMessage = {
                id: 'manager-' + Date.now(),
                sender: 'manager',
                text: MOCK_MANAGER_DECISION,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, managerMsg]);
            setLoadingStep(null); // Clear all loading indicators
            setIsProcessing(false);
        }, 3500);
    };

    const getAgentIcon = (type: AgentType) => {
        switch (type) {
            case AgentType.TRAINER: return <Dumbbell size={20} className="text-slate-600" />;
            case AgentType.NUTRITIONIST: return <Utensils size={20} className="text-emerald-600" />;
            case AgentType.WELLNESS: return <Sun size={20} className="text-amber-600" />;
            case AgentType.MANAGER: return <ShieldCheck size={24} className="text-stone-100" />;
            default: return <Bot size={20} />;
        }
    };

    const getAgentStyles = (type: AgentType) => {
        switch (type) {
            case AgentType.TRAINER: return 'border-slate-200 bg-slate-50';
            case AgentType.NUTRITIONIST: return 'border-emerald-200 bg-emerald-50';
            case AgentType.WELLNESS: return 'border-amber-200 bg-amber-50';
            default: return 'border-gray-200 bg-white';
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
            <div className="mb-4 text-center border-b border-stone-100 pb-2">
                <h2 className="text-lg font-bold text-stone-800">Consultation Room</h2>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-6 px-4 pb-4 scrollbar-hide">
                {messages.map((msg) => (
                    <div key={msg.id} className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">

                        {/* User Message */}
                        {msg.sender === 'user' && (
                            <div className="flex justify-end mb-2">
                                <div className="flex items-start space-x-3 max-w-[85%] flex-row-reverse space-x-reverse">
                                    <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center shrink-0 shadow-sm">
                                        <User size={16} className="text-white" />
                                    </div>
                                    <div className="bg-white border border-stone-200 rounded-2xl rounded-tr-none px-5 py-3 shadow-sm">
                                        <p className="text-stone-800 leading-relaxed text-sm md:text-base">{msg.text}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* System Message (Welcome / Static Info) */}
                        {msg.sender === 'system' && (
                            <div className="flex justify-start my-4 max-w-[90%]">
                                {msg.id === 'init' ? (
                                    <div className="flex items-start space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
                                            <Bot size={18} className="text-stone-500" />
                                        </div>
                                        <div className="bg-stone-100 text-stone-600 text-sm px-5 py-3 rounded-2xl rounded-tl-none border border-stone-200 shadow-sm">
                                            {msg.text}
                                        </div>
                                    </div>
                                ) : (
                                    // Fallback for any non-init system messages
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center shrink-0">
                                            <Sparkles size={16} className="text-stone-400" />
                                        </div>
                                        <span className="text-stone-500 text-sm">{msg.text}</span>
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
                                            <div className="w-10 h-10 rounded-full bg-white border border-stone-100 flex items-center justify-center shadow-sm">
                                                {getAgentIcon(agent.agentType)}
                                            </div>
                                        </div>

                                        {/* Content Right */}
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-stone-900 mb-1">{agent.agentType}</h4>
                                            <div className="text-sm text-stone-600 leading-relaxed mb-3 prose prose-stone prose-sm max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{agent.content}</ReactMarkdown>
                                            </div>
                                            <div className="pt-2 border-t border-black/5">
                                                <p className="text-xs font-bold text-stone-900">
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
                                <div className="bg-stone-900 rounded-xl p-5 shadow-md text-stone-100 flex flex-col md:flex-row gap-4 items-start border border-stone-700">
                                    {/* Avatar / Icon Left */}
                                    <div className="shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-stone-800 border border-stone-600 flex items-center justify-center shadow-sm">
                                            <ShieldCheck size={20} className="text-white" />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="font-bold text-base mb-1 text-white">Manager Agent <span className="text-stone-400 font-normal text-sm">- Final Decision</span></h3>
                                        <div className="text-stone-300 text-sm leading-relaxed mb-3 prose prose-invert prose-sm max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                        </div>
                                        <div className="inline-flex items-center space-x-2 bg-stone-800 px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-stone-700">
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
                            <div className="w-8 h-8 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center shrink-0 shadow-sm">
                                <Loader2 size={16} className="text-stone-400 animate-spin" />
                            </div>
                            <span className="text-stone-500 text-xs uppercase tracking-widest font-semibold bg-stone-50 px-3 py-1.5 rounded-full border border-stone-100 shadow-sm">
                                Consulting Physical Trainer, Nutritionist, and Wellness Coach...
                            </span>
                        </div>
                    </div>
                )}

                {loadingStep === 'reviewing' && (
                    <div className="flex justify-start my-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center space-x-3 ml-1">
                            <div className="h-1 w-1 bg-stone-300 rounded-full animate-bounce delay-0"></div>
                            <div className="h-1 w-1 bg-stone-300 rounded-full animate-bounce delay-150"></div>
                            <div className="h-1 w-1 bg-stone-300 rounded-full animate-bounce delay-300"></div>
                            <span className="text-stone-400 text-xs font-medium ml-2">Manager Reviewing...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="mt-2 px-4 pb-6 pt-2 bg-stone-50">
                <form onSubmit={handleSend} className="relative max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={isProcessing}
                        placeholder={isProcessing ? "Analysis in progress..." : "Type your update (e.g., 'Knee feels unstable')"}
                        className="w-full bg-white border border-stone-300 text-stone-900 rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 shadow-sm placeholder:text-stone-400 transition-all text-base"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || isProcessing}
                        className="absolute right-2 top-2 p-2.5 bg-stone-800 text-white rounded-xl hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatView;
