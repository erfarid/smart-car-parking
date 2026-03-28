import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";

function destinationForRole(role) {
  if (role === "admin") return "/";
  if (role === "worker") return "/worker";
  return "/driver";
}

export default function RegisterPage() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const needsCode = role === "admin" || role === "worker";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await ApiClient.register(name, email, password, role, needsCode ? authorizationCode : "");
      loginUser(user);
      navigate(destinationForRole(user.role));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="login-page"
      style={{
        backgroundImage:
          "linear-gradient(rgba(15, 23, 42, 0.68), rgba(30, 41, 59, 0.68)), url('/car_background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="login-card">
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M9 3v18" />
            <path d="M3 9h6" />
            <path d="M3 15h6" />
          </svg>
          <h1>Smart Parking</h1>
          <p>Create a new account</p>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              className="input"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="input"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label>Register as</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">Normal User</option>
              <option value="admin">Admin</option>
              <option value="worker">Worker</option>
            </select>
          </div>

          {needsCode && (
            <div className="form-group">
              <label>{role === "admin" ? "Admin Authorization Code" : "Worker Authorization Code"}</label>
              <input
                type="text"
                className="input"
                placeholder={role === "admin" ? "Enter admin code" : "Enter worker code"}
                value={authorizationCode}
                onChange={(e) => setAuthorizationCode(e.target.value)}
                required={needsCode}
              />
              <small className="text-muted" style={{ marginBottom: 0 }}>
                {role === "worker"
                  ? "Workers are only allowed when the number of workers does not exceed active parking sessions."
                  : "Contact the system administrator for the authorization code."}
              </small>
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--lg" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p>
            <Link to="/">Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
