import ApiClient from "../services/ApiClient";
export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing__blur landing__blur--one"></div>
      <div className="landing__blur landing__blur--two"></div>

      <header className="landing__header">
        <div className="landing__brand">
          <div className="landing__logo">P</div>
          <div>
            <h1 className="landing__brand-title">ParkVision</h1>
            <p className="landing__brand-subtitle">
              Smart Parking Plate Recognition & Dynamic Pricing
            </p>
          </div>
        </div>

        <nav className="landing__nav">
          <a href="/login" className="landing__nav-btn landing__nav-btn--signin">
            Sign In
          </a>

          <a
            href="/register"
            className="landing__nav-btn landing__nav-btn--signin"
          >
            Register
          </a>
        </nav>
      </header>

      <main className="landing__hero">
        <section className="landing__content">
          <span className="landing__badge">AI Powered Parking Control</span>

          <h2 className="landing__title">
            Modern Parking
            <br />
            Management for
            <br />
            Smarter Cities
          </h2>

          <p className="landing__text">
            Detect license plates, manage parking sessions, apply dynamic
            pricing, and monitor violations from one fast and elegant admin
            platform.
          </p>

          <div className="landing__stats">
            <div className="landing__stat">
              <h3>90%+</h3>
              <p>Detection Accuracy</p>
            </div>
            <div className="landing__stat">
              <h3>&lt; 5s</h3>
              <p>Processing Time</p>
            </div>
            <div className="landing__stat">
              <h3>24/7</h3>
              <p>Monitoring</p>
            </div>
          </div>
        </section>

        <section className="landing__panel">
          <div className="landing__card">
            <div className="landing__status">
              <span className="landing__status-dot"></span>
              <span className="landing__status-text">System Online</span>
            </div>

            <h3 className="landing__card-title">Welcome Back</h3>
            <p className="landing__card-text">
              Access the parking platform to manage sessions, monitor payments,
              configure zones, and review reports in real time.
            </p>

            <div className="landing__features">
              <div className="landing__feature">Plate recognition with OCR</div>
              <div className="landing__feature">Dynamic fee calculation</div>
              <div className="landing__feature">Zone and session management</div>
              <div className="landing__feature">Reporting and monitoring</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}