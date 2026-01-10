import React from 'react';
import './GlobeLoadingScreen.css';

interface GlobeLoadingScreenProps {
  isExiting?: boolean;
}

const GlobeLoadingScreen: React.FC<GlobeLoadingScreenProps> = ({ isExiting = false }) => {
  return (
    <div className={`globe-loading-screen ${isExiting ? 'exiting' : ''}`}>
      <div className="globe-container">
        {/* Ambient glow effects */}
        <div className="ambient-glow ambient-glow-top" />
        <div className="ambient-glow ambient-glow-bottom" />

        <div className="globe-content">
          <h2 className="globe-title">Loading.....</h2>
          <p className="globe-subtitle">
            loading dependencies, creating and saving your account
          </p>

          {/* Globe illustration */}
          <div className="globe-illustration">
            <svg
              viewBox="0 0 300 300"
              className="globe-svg"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Glow hub */}
                <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.9)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0.1)" />
                </radialGradient>
                {/* Line trail gradients - dark mode */}
                <linearGradient id="trailBright" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="trailDim" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
                </linearGradient>
                {/* Light mode gradients */}
                <linearGradient id="trailBrightLight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0891b2" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#4338ca" stopOpacity="0.6" />
                </linearGradient>
                <linearGradient id="trailDimLight" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0891b2" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#4338ca" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              {/* Globe group */}
              <g>
                {/* Latitude lines */}
                {[...Array(6)].map((_, i) => (
                  <ellipse
                    key={`lat-${i}`}
                    cx="150"
                    cy="150"
                    rx={120}
                    ry={40 + i * 12}
                    className="globe-latitude"
                    strokeDasharray="5 5"
                    transform="rotate(-25,150,150)"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}

                {/* Longitude lines */}
                {[...Array(8)].map((_, i) => (
                  <path
                    key={`lon-${i}`}
                    d="M150,30 A120,120 0 0,1 150,270"
                    className="globe-longitude"
                    strokeDasharray="4 4"
                    transform={`rotate(${i * 22.5},150,150)`}
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}

                {/* Orbital trails */}
                <ellipse
                  cx="150"
                  cy="150"
                  rx="140"
                  ry="60"
                  className="globe-orbit-bright"
                  strokeDasharray="10 10"
                  transform="rotate(20,150,150)"
                />
                <ellipse
                  cx="150"
                  cy="150"
                  rx="130"
                  ry="50"
                  className="globe-orbit-dim"
                  strokeDasharray="12 12"
                  transform="rotate(-40,150,150)"
                />
              </g>
            </svg>
          </div>

          {/* Loading indicator */}
          <div className="loading-indicator">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobeLoadingScreen;
