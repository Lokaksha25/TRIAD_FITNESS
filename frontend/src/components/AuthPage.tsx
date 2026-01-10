import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import './AuthPage.css';

const AuthPage: React.FC = () => {
    const navigate = useNavigate();
    const { signInWithGoogle } = useAuth();
    const [isPanelActive, setIsPanelActive] = useState(false);

    // Login State
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register State
    const [registerName, setRegisterName] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
            navigate('/dashboard');
        } catch (err: any) {
            setError('Failed to sign in with Google. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            navigate('/dashboard');
        } catch (err: any) {
            console.error("Login Error:", err);
            // Firebase error codes
            if (err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else {
                setError('Failed to login. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);

            // Update profile with name
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: registerName
                });

                // Sync with Backend (Pinecone)
                try {
                    const response = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            user_id: userCredential.user.uid,
                            email: registerEmail,
                            name: registerName
                        }),
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        console.error("Backend signup failed:", errText);
                        alert("Warning: Backend synchronization failed. Some features may not work. Error: " + errText);
                    }
                } catch (backendErr) {
                    console.error("Backend signup sync network error:", backendErr);
                    alert("Warning: Could not connect to backend server. Please check if the server is running.");
                    // Non-blocking, still proceed to chat but warn user
                }
            }

            navigate('/onboarding');
        } catch (err: any) {
            console.error("Registration Error:", err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Email is already in use.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password should be at least 6 characters.');
            } else {
                setError('Failed to register. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className={`auth-wrapper ${isPanelActive ? 'panel-active' : ''}`} id="authWrapper">
                {/* Register Form */}
                <div className="auth-form-box register-form-box">
                    <form onSubmit={handleRegister}>
                        <h1>Create Account</h1>
                        <div className="social-links">
                            {/* Reusing Google Sign In for consistency */}
                            <a href="#" aria-label="Google" onClick={(e) => { e.preventDefault(); handleGoogleSignIn(); }}>
                                <i className="fab fa-google"></i>
                            </a>
                        </div>
                        <span>or use your email for registration</span>
                        {error && isPanelActive && <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                        <input
                            type="text"
                            placeholder="Full Name"
                            required
                            value={registerName}
                            onChange={(e) => setRegisterName(e.target.value)}
                        />
                        <input
                            type="email"
                            placeholder="Email Address"
                            required
                            value={registerEmail}
                            onChange={(e) => setRegisterEmail(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            value={registerPassword}
                            onChange={(e) => setRegisterPassword(e.target.value)}
                        />
                        <button type="submit" disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Sign Up'}
                        </button>
                        <div className="mobile-switch">
                            <p>Already have an account?</p>
                            <button type="button" onClick={() => setIsPanelActive(false)}>Sign In</button>
                        </div>
                    </form>
                </div>

                {/* Login Form */}
                <div className="auth-form-box login-form-box">
                    <form onSubmit={handleLogin}>
                        <h1>Sign In</h1>
                        <div className="social-links">
                            <a href="#" aria-label="Google" onClick={(e) => { e.preventDefault(); handleGoogleSignIn(); }}>
                                <i className="fab fa-google"></i>
                            </a>
                        </div>
                        <span>or use your account</span>
                        {error && !isPanelActive && <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                        <input
                            type="email"
                            placeholder="Email Address"
                            required
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                        />
                        <a href="#" onClick={(e) => e.preventDefault()}>Forgot your password?</a>
                        <button type="submit" disabled={isLoading}>
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                        <div className="mobile-switch">
                            <p>Don't have an account?</p>
                            <button type="button" onClick={() => setIsPanelActive(true)}>Sign Up</button>
                        </div>
                    </form>
                </div>

                {/* Slide Panel */}
                <div className="slide-panel-wrapper">
                    <div className="slide-panel">
                        <div className="panel-content panel-content-left">
                            <h1>Welcome Back!</h1>
                            <p>Stay connected by logging in with your credentials and continue your fitness journey</p>
                            <button className="transparent-btn" onClick={() => { setIsPanelActive(false); setError(null); }}>Sign In</button>
                        </div>
                        <div className="panel-content panel-content-right">
                            <h1>Hey There!</h1>
                            <p>Begin your amazing fitness journey by creating an account with us today</p>
                            <button className="transparent-btn" onClick={() => { setIsPanelActive(true); setError(null); }}>Sign Up</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
