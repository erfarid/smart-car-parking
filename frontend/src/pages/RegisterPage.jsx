import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ApiClient from "../services/ApiClient";

const initialForm = {
  role: "user",
  fullName: "",
  email: "",
  phone: "",
  address: "",
  password: "",
  confirmPassword: "",
  adminCode: "",
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleRoleChange(role) {
    setForm((prev) => ({
      ...prev,
      role,
      adminCode: role === "admin" ? prev.adminCode : "",
    }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !form.fullName ||
      !form.email ||
      !form.phone ||
      !form.address ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.role === "admin" && !form.adminCode.trim()) {
      setError("Admin code is required for admin registration.");
      return;
    }

    try {
      await ApiClient.registerUser({
        full_name: form.fullName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        password: form.password,
        role: form.role,
        admin_code: form.role === "admin" ? form.adminCode : "",
      });

      setSuccess("Registration successful.");
      setForm(initialForm);

      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__blur auth-page__blur--one"></div>
      <div className="auth-page__blur auth-page__blur--two"></div>

      <div className="auth-card auth-card--wide">
        <div className="auth-card__header">
          <div className="auth-card__logo">P</div>
          <div>
            <h1 className="auth-card__title">Create Account</h1>
            <p className="auth-card__subtitle">
              Register as a driver/user or as an admin with a special code
            </p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-role-switch">
            <button
              type="button"
              className={`auth-role-switch__btn ${
                form.role === "user" ? "auth-role-switch__btn--active" : ""
              }`}
              onClick={() => handleRoleChange("user")}
            >
              User / Driver
            </button>

            <button
              type="button"
              className={`auth-role-switch__btn ${
                form.role === "admin" ? "auth-role-switch__btn--active" : ""
              }`}
              onClick={() => handleRoleChange("admin")}
            >
              Admin
            </button>
          </div>

          <div className="auth-form__grid">
            <div className="auth-form__group">
              <label className="auth-form__label">Full Name</label>
              <input
                type="text"
                name="fullName"
                className="auth-form__input"
                value={form.fullName}
                onChange={handleChange}
              />
            </div>

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
              <label className="auth-form__label">Phone Number</label>
              <input
                type="text"
                name="phone"
                className="auth-form__input"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            <div className="auth-form__group">
              <label className="auth-form__label">Address</label>
              <input
                type="text"
                name="address"
                className="auth-form__input"
                value={form.address}
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

            <div className="auth-form__group">
              <label className="auth-form__label">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                className="auth-form__input"
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>

          {form.role === "admin" && (
            <div className="auth-form__group auth-form__group--full">
              <label className="auth-form__label">Admin Special Code</label>
              <input
                type="text"
                name="adminCode"
                className="auth-form__input"
                value={form.adminCode}
                onChange={handleChange}
              />
            </div>
          )}

          {error && (
            <div className="auth-message auth-message--error">{error}</div>
          )}
          {success && (
            <div className="auth-message auth-message--success">{success}</div>
          )}

          <button type="submit" className="auth-form__submit">
            Register
          </button>
          <button
            type="button"
            className="auth-form__submit"
            onClick={() => navigate("/")}
          >
            Back
          </button>

          <p className="auth-form__footer">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}