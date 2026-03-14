import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ApiClient from "../services/ApiClient";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password.trim()) {
    setError("Please fill the details");
    return;
  }

    try {
      const data = await ApiClient.loginUser(form);

      // optional: store user if backend returns it
      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      // keep your old behavior
      if (data?.user?.role === "admin") navigate("/admin");
      else navigate("/driver");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__blur auth-page__blur--one"></div>
      <div className="auth-page__blur auth-page__blur--two"></div>

      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__logo">P</div>
          <div>
            <h1 className="auth-card__title">Login</h1>
            <p className="auth-card__subtitle">
              Sign in to access your parking dashboard
            </p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__group">
            <label className="auth-form__label">Email</label>
            <input
              type="email"
              name="email"
              className="auth-form__input"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className="auth-form__group">
            <label className="auth-form__label">Password</label>
            <input
              type="password"
              name="password"
              className="auth-form__input"
              value={form.password}
              onChange={handleChange}
            />
          </div>

          {error && (
            <div className="auth-message auth-message--error">{error}</div>
          )}

          <button type="submit" className="auth-form__submit">
            Login
          </button>
          <button
            type="button"
            className="auth-form__submit"
            onClick={() => navigate("/")}
          >
            Back
          </button>

          <p className="auth-form__footer">
            Don&apos;t have an account? <Link to="/register">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}