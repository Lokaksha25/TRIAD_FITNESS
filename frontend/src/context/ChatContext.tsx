import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AgentType, ChatMessage } from '../types';
import { MOCK_MANAGER_DECISION } from '../constants';

interface ChatContextType {
    messages: ChatMessage[];
    isProcessing: boolean;
    loadingStep: 'analyzing' | 'reviewing' | null;
    sendMessage: (text: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        const saved = localStorage.getItem('TRIAD_CHAT_HISTORY');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
            } catch (e) {
                console.error("Failed to parse chat history", e);
            }
        }
        return [{
            id: 'init',
            sender: 'system',
            text: 'Welcome to Triad Fitness. Describe your current status or goal to begin analysis.',
            timestamp: new Date()
        }];
    });

    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingStep, setLoadingStep] = useState<'analyzing' | 'reviewing' | null>(null);

    // Persistence
    useEffect(() => {
        localStorage.setItem('TRIAD_CHAT_HISTORY', JSON.stringify(messages));
    }, [messages]);

    const sendMessage = async (userText: string) => {
        if (!userText.trim() || isProcessing) return;

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
            // 2. Fetch Agents
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userText })
            });

            if (!response.ok) throw new Error("API Call Failed");

            const data = await response.json();

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

        // 3. Manager Decision
        setTimeout(() => {
            const managerMsg: ChatMessage = {
                id: 'manager-' + Date.now(),
                sender: 'manager',
                text: MOCK_MANAGER_DECISION,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, managerMsg]);
            setLoadingStep(null);
            setIsProcessing(false);
        }, 3500);
    };

    return (
        <ChatContext.Provider value={{ messages, isProcessing, loadingStep, sendMessage }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
