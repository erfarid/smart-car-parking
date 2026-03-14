import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ApiClient from "../services/ApiClient";

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [zones, setZones] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  function handleLogout() {
    // Clear any saved auth state (safe even if keys don’t exist)
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("auth");

    navigate("/login");
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [sum, z, sessions] = await Promise.all([
        ApiClient.revenueSummary(),
        ApiClient.listZones(),
        ApiClient.listSessions(),
      ]);
      setSummary(sum);
      setZones(z);
      setRecentSessions(sessions.slice(0, 15));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="page-loading">Loading dashboard...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  const activeSessions = recentSessions.filter((s) => s.status === "active");

  return (
    <div className="page">
      {/* Header: title left + logout right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
        <button className="landing__nav-btn landing__nav-btn--signin" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Summary Cards */}
      <div className="card-grid">
        <div className="stat-card stat-card--revenue">
          <div className="stat-card__label">Total Revenue</div>
          <div className="stat-card__value">
            {(summary.total_revenue || 0).toLocaleString()} HUF
          </div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__label">Paid Sessions</div>
          <div className="stat-card__value">{summary.paid_count}</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__label">Unpaid Sessions</div>
          <div className="stat-card__value">{summary.unpaid_count}</div>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card__label">Overdue Sessions</div>
          <div className="stat-card__value">{summary.overdue_count}</div>
        </div>
        <div className="stat-card stat-card--info">
          <div className="stat-card__label">Total Zones</div>
          <div className="stat-card__value">{zones.length}</div>
        </div>
        <div className="stat-card stat-card--active">
          <div className="stat-card__label">Active Now</div>
          <div className="stat-card__value">{activeSessions.length}</div>
        </div>
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div className="card">
          <h2>Active Sessions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Plate</th>
                  <th>Zone</th>
                  <th>Entry Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((s) => (
                  <tr key={s.session_id}>
                    <td className="mono">{s.session_id.slice(0, 8)}...</td>
                    <td className="mono bold">{s.plate_number}</td>
                    <td>{s.zone_id}</td>
                    <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                    <td>
                      <span className="badge badge--active">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="card">
        <h2>Recent Sessions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Plate</th>
                <th>Zone</th>
                <th>Duration</th>
                <th>Final Fee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr key={s.session_id}>
                  <td className="mono">{s.session_id.slice(0, 8)}...</td>
                  <td className="mono bold">{s.plate_number}</td>
                  <td>{s.zone_id}</td>
                  <td>
                    {s.duration_minutes != null ? `${s.duration_minutes} min` : "—"}
                  </td>
                  <td>
                    {s.final_fee != null ? `${s.final_fee.toLocaleString()} HUF` : "—"}
                  </td>
                  <td>
                    <span className={`badge badge--${s.status}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}