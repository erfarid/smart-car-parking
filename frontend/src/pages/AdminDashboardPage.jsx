import { useState, useEffect, useCallback } from "react";
import ApiClient from "../services/ApiClient";
import { getDistrictLabel, sortDistricts } from "../utils/budapestDistricts";

const REFRESH_INTERVAL = 15000; // 15 seconds auto-refresh

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [zones, setZones] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [congestion, setCongestion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [sum, z, sessions, vehs, cong] = await Promise.all([
        ApiClient.revenueSummary(),
        ApiClient.listZones(),
        ApiClient.listSessions(),
        ApiClient.listVehicles(),
        ApiClient.getCongestion(),
      ]);
      setSummary(sum);
      setZones(sortDistricts(Array.isArray(z) ? z : []));
      setRecentSessions(sessions.slice(0, 30));
      setVehicles(vehs);
      setCongestion(cong);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => loadDashboard(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  if (loading) return <div className="page-loading">Loading dashboard...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  const activeSessions = recentSessions.filter((s) => s.status === "active");
  const unpaidSessions = recentSessions.filter((s) => s.status === "unpaid" || s.status === "overdue");

  // Build per-vehicle payment summary
  const vehiclePaymentMap = {};
  recentSessions.forEach((s) => {
    if (!vehiclePaymentMap[s.plate_number]) {
      vehiclePaymentMap[s.plate_number] = { paid: 0, unpaid: 0, overdue: 0, active: 0, total_unpaid_fee: 0 };
    }
    const entry = vehiclePaymentMap[s.plate_number];
    if (s.status === "paid") entry.paid++;
    else if (s.status === "unpaid") { entry.unpaid++; entry.total_unpaid_fee += s.final_fee || 0; }
    else if (s.status === "overdue") { entry.overdue++; entry.total_unpaid_fee += s.final_fee || 0; }
    else if (s.status === "active") entry.active++;
  });

  // Congestion map
  const congestionMap = {};
  congestion.forEach((c) => (congestionMap[c.zone_id] = c));

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>Admin Dashboard</h1>
        <div className="auto-refresh-indicator">
          <span className="auto-refresh-dot" />
          Live {lastUpdate && `- ${lastUpdate.toLocaleTimeString()}`}
          <button className="btn btn--sm btn--outline" onClick={() => loadDashboard(false)} style={{ marginLeft: 8 }}>
            Refresh
          </button>
        </div>
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
          <div className="stat-card__label">Total Districts</div>
          <div className="stat-card__value">{zones.length}</div>
        </div>
        <div className="stat-card stat-card--active">
          <div className="stat-card__label">Active Now</div>
          <div className="stat-card__value">{activeSessions.length}</div>
        </div>
      </div>

      {/* Zone Congestion Overview */}
      <div className="card">
        <h2>District Activity Status</h2>
        <div className="congestion-grid">
          {zones.map((z) => {
            const cData = congestionMap[z.zone_id];
            const count = cData?.active_vehicles || 0;
            const level = cData?.congestion_level || "low";
            return (
              <div key={z.zone_id} className={`congestion-card congestion-card--${level}`}>
                <div className="congestion-card__zone">{z.zone_id}</div>
                <div className="congestion-card__name">{getDistrictLabel(z)}</div>
                <div className="congestion-card__count">{count} active</div>
                <div className={`congestion-card__level congestion-card__level--${level}`}>
                  {level === "low" ? "Low" : level === "medium" ? "Medium" : "High"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vehicle Payment Status */}
      <div className="card">
        <h2>Vehicle Payment Status (Real-time)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plate Number</th>
                <th>Active</th>
                <th>Paid</th>
                <th>Unpaid</th>
                <th>Overdue</th>
                <th>Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(vehiclePaymentMap)
                .sort((a, b) => b[1].total_unpaid_fee - a[1].total_unpaid_fee)
                .slice(0, 25)
                .map(([plate, data]) => (
                  <tr key={plate}>
                    <td className="mono bold">{plate}</td>
                    <td>{data.active}</td>
                    <td>{data.paid}</td>
                    <td>{data.unpaid}</td>
                    <td>{data.overdue}</td>
                    <td className="bold">
                      {data.total_unpaid_fee > 0
                        ? `${data.total_unpaid_fee.toLocaleString()} HUF`
                        : "-"}
                    </td>
                    <td>
                      {data.overdue > 0 ? (
                        <span className="badge badge--overdue">Overdue</span>
                      ) : data.unpaid > 0 ? (
                        <span className="badge badge--unpaid">Unpaid</span>
                      ) : data.active > 0 ? (
                        <span className="badge badge--active">Active</span>
                      ) : (
                        <span className="badge badge--paid">Clear</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div className="card">
          <h2>Active Sessions ({activeSessions.length})</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Plate</th>
                  <th>District</th>
                  <th>Entry Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((s) => (
                  <tr key={s.session_id}>
                    <td className="mono">{s.session_id.slice(0, 8)}...</td>
                    <td className="mono bold">{s.plate_number}</td>
                    <td>{getDistrictLabel(s.zone_id)}</td>
                    <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                    <td><span className="badge badge--active">Active</span></td>
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
                <th>District</th>
                <th>Duration</th>
                <th>Final Fee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.slice(0, 15).map((s) => (
                <tr key={s.session_id}>
                  <td className="mono">{s.session_id.slice(0, 8)}...</td>
                  <td className="mono bold">{s.plate_number}</td>
                  <td>{getDistrictLabel(s.zone_id)}</td>
                  <td>{s.duration_minutes != null ? `${s.duration_minutes} min` : "-"}</td>
                  <td>
                    {s.final_fee != null
                      ? `${s.final_fee.toLocaleString()} HUF`
                      : "-"}
                  </td>
                  <td>
                    <span className={`badge badge--${s.status}`}>
                      {s.status}
                    </span>
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
