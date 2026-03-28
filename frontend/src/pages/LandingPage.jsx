import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  const heroBackgroundStyle = {
    backgroundImage:
      "linear-gradient(rgba(15, 23, 42, 0.55), rgba(15, 23, 42, 0.55)), url('/car_background.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  return (
    <div className="landing">
      {/* Hero */}
      <header className="landing__hero" style={heroBackgroundStyle}>
        <div className="landing__hero-content">
          <div className="landing__logo-row">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M9 3v18" />
              <path d="M3 9h6" />
              <path d="M3 15h6" />
            </svg>
            <span className="landing__brand">Smart Parking</span>
          </div>
          <h1>Budapest Smart Parking Management System</h1>
          <p className="landing__subtitle">
            An intelligent parking management platform for Budapest. AI-powered license plate
            detection, real-time zone congestion monitoring, automated fee calculation with
            penalty enforcement, and seamless digital payments — all in one system.
          </p>
          <div className="landing__cta">
            <button className="btn btn--primary btn--lg" onClick={() => navigate("/login")}>
              Sign In
            </button>
            <button className="btn btn--outline btn--lg" onClick={() => navigate("/register")}>
              Register
            </button>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="landing__section">
        <h2>Platform Features</h2>
        <div className="landing__features">
          <div className="landing__feature-card">
            <div className="landing__feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <h3>AI Plate Detection</h3>
            <p>Upload a photo of any vehicle and our YOLOv8 + EasyOCR engine instantly detects the license plate number with high accuracy.</p>
          </div>
          <div className="landing__feature-card">
            <div className="landing__feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </div>
            <h3>Live Congestion Map</h3>
            <p>Interactive Budapest map showing real-time parking zone congestion with color-coded markers — green, yellow, and red indicators.</p>
          </div>
          <div className="landing__feature-card">
            <div className="landing__feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <h3>Digital Payments</h3>
            <p>Pay parking fees instantly through the platform. View receipts, track payment history, and clear outstanding dues with one click.</p>
          </div>
          <div className="landing__feature-card">
            <div className="landing__feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
            <h3>Revenue Analytics</h3>
            <p>Comprehensive admin dashboard with revenue charts, zone performance analysis, and real-time session monitoring.</p>
          </div>
          <div className="landing__feature-card">
            <div className="landing__feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3>Session Management</h3>
            <p>Start, track, and end parking sessions. Automatic fee calculation with overstay penalties and repeat-parking surcharges.</p>
          </div>
          <div className="landing__feature-card">
            <div className="landing__feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3>Penalty & Legal Enforcement</h3>
            <p>Parking is billed at 10 HUF per minute after a 10-minute grace period, with a 50 HUF minimum fee. Warning messages appear at 10,000 HUF and 20,000 HUF with Hungarian regulation notices.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing__section landing__section--alt">
        <h2>How It Works</h2>
        <div className="landing__steps">
          <div className="landing__step">
            <div className="landing__step-num">1</div>
            <h3>Register & Sign In</h3>
            <p>Create an account as a driver or admin. Admins need a special authorization code to access management features.</p>
          </div>
          <div className="landing__step">
            <div className="landing__step-num">2</div>
            <h3>Park Your Vehicle</h3>
            <p>Drive to any Budapest parking zone. Upload a photo of your plate or manually enter your plate number to start a session.</p>
          </div>
          <div className="landing__step">
            <div className="landing__step-num">3</div>
            <h3>Track & Monitor</h3>
            <p>View your active sessions, check zone congestion on the live map, and monitor fees in real time from your dashboard.</p>
          </div>
          <div className="landing__step">
            <div className="landing__step-num">4</div>
            <h3>Pay & Go</h3>
            <p>End your session and pay securely through the platform. Get instant receipts and keep your payment history clean.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing__footer">
        <p>Smart Parking Budapest &mdash; Intelligent Parking Management System</p>
        <p className="text-muted">Built with FastAPI, React, YOLOv8, EasyOCR, and Leaflet</p>
      </footer>
    </div>
  );
}
