import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import NutritionistView from './components/NutritionistView';
import TrainerView from './components/TrainerView';
import WellnessView from './components/WellnessView';
import ManagerView from './components/ManagerView';

import ChatView from './components/ChatView';
import ProfileSettings from './components/ProfileSettings';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import OnboardingPage from './components/OnboardingPage';
import { ChatProvider } from './context/ChatContext';
import { AuthProvider } from './context/AuthContext';

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <ChatProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/chat" element={<ChatView />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/nutritionist" element={<NutritionistView />} />
                    <Route path="/trainer" element={<TrainerView />} />
                    <Route path="/wellness" element={<WellnessView />} />
                    <Route path="/manager" element={<ManagerView />} />

                    <Route path="/profile" element={<ProfileSettings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
        </ChatProvider>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
