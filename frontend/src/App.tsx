import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import NutritionistView from './components/NutritionistView';
import TrainerView from './components/TrainerView';
import WellnessView from './components/WellnessView';
import ManagerView from './components/ManagerView';
import TimelineView from './components/TimelineView';
import ChatView from './components/ChatView';
import ProfileSettings from './components/ProfileSettings';
import LandingPage from './components/LandingPage';
import { ChatProvider } from './context/ChatContext';

const App: React.FC = () => {
  return (
    <HashRouter>
      <ChatProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
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
                  <Route path="/timeline" element={<TimelineView />} />
                  <Route path="/profile" element={<ProfileSettings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </ChatProvider>
    </HashRouter>
  );
};

export default App;
