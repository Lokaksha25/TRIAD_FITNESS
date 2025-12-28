import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SplineScene } from "@/components/ui/spline";
import { Card } from "@/components/ui/card";
import { Spotlight } from "@/components/ui/spotlight";
import { Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    const handleDiscoverClick = () => {
        navigate('/chat');
    };

    return (
        <div className="w-full min-h-screen bg-black/[0.96] relative overflow-hidden flex items-center justify-center">
            <Spotlight
                className="-top-40 left-0 md:left-60 md:-top-20"
                fill="white"
            />

            <div className="flex h-full w-full max-w-7xl mx-auto flex-col md:flex-row">
                {/* Left content */}
                <div className="flex-1 p-8 relative z-10 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                            <Brain className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white tracking-wider">TRIAD FITNESS</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 leading-tight">
                        Your one-stop solution for achieving your fitness goals  
                    </h1>
                    <p className="mt-4 text-neutral-300 max-w-lg text-lg">
AI-powered nutrition, training, and wellness — all in one place.                    </p>

                    <div className="mt-8">
                        <Button
                            onClick={handleDiscoverClick}
                            className="bg-white text-black hover:bg-neutral-200 text-lg px-8 py-6 rounded-full font-semibold transition-all duration-300 hover:scale-105"
                        >
                            Start Your Journey
                        </Button>
                    </div>
                </div>

                {/* Right content */}
                <div className="flex-1 relative h-[500px] md:h-auto min-h-[500px]">
                    <SplineScene
                        scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                        className="w-full h-full"
                    />
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
