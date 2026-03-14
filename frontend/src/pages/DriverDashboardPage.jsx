import { useState } from "react";
import ApiClient from "../services/ApiClient";

export default function DriverDashboardPage() {
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicle, setVehicle] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  async function handleLookup(e) {
    e.preventDefault();
    if (!plateNumber.trim()) return;

    setLoading(true);
    setError(null);
    setVehicle(null);
    setSessions([]);
    setSearched(true);

    try {
      const v = await ApiClient.getVehicle(plateNumber.trim().toUpperCase());
      setVehicle(v);

      const allSessions = await ApiClient.listSessions();
      const mySessions = allSessions.filter(
        (s) => s.plate_number === plateNumber.trim().toUpperCase()
      );
      setSessions(mySessions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const activeSessions = sessions.filter((s) => s.status === "active");
  const totalFees = sessions.reduce((sum, s) => sum + (s.final_fee || 0), 0);
  const unpaidCount = sessions.filter((s) => s.status === "unpaid").length;

  return (
    <div className="page">
      <h1>Driver Dashboard</h1>

      {/* Lookup Form */}
      <div className="card">
        <h2>Look Up Your Vehicle</h2>
        <form onSubmit={handleLookup} className="form-row">
          <input
            type="text"
            placeholder="Enter plate number (e.g. ABC-1234)"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            className="input"
          />
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {searched && !loading && !error && !vehicle && (
        <div className="alert alert--warning">
          No vehicle found with plate "{plateNumber.toUpperCase()}". Make sure
          your vehicle is registered.
        </div>
      )}

      {/* Vehicle Info */}
      {vehicle && (
        <>
          <div className="card">
            <h2>Vehicle Information</h2>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Plate Number</span>
                <span className="detail-value mono bold">
                  {vehicle.plate_number}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Owner</span>
                <span className="detail-value">{vehicle.owner_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Vehicle Type</span>
                <span className="detail-value">{vehicle.vehicle_type}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  <span
                    className={`badge badge--${
                      vehicle.registration_status === "active"
                        ? "active"
                        : "unpaid"
                    }`}
                  >
                    {vehicle.registration_status}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="card-grid">
            <div className="stat-card stat-card--info">
              <div className="stat-card__label">Total Sessions</div>
              <div className="stat-card__value">{sessions.length}</div>
            </div>
            <div className="stat-card stat-card--active">
              <div className="stat-card__label">Active Now</div>
              <div className="stat-card__value">{activeSessions.length}</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__label">Unpaid</div>
              <div className="stat-card__value">{unpaidCount}</div>
            </div>
            <div className="stat-card stat-card--revenue">
              <div className="stat-card__label">Total Fees</div>
              <div className="stat-card__value">
                {totalFees.toLocaleString()} HUF
              </div>
            </div>
          </div>

          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div className="card">
              <h2>Currently Parked</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Zone</th>
                      <th>Entry Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.map((s) => (
                      <tr key={s.session_id}>
                        <td className="mono">
                          {s.session_id.slice(0, 8)}...
                        </td>
                        <td>{s.zone_id}</td>
                        <td>
                          {new Date(s.entry_timestamp).toLocaleString()}
                        </td>
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

          {/* Session History */}
          {sessions.length > 0 && (
            <div className="card">
              <h2>Parking History</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Zone</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Duration</th>
                      <th>Base Fee</th>
                      <th>Penalties</th>
                      <th>Final Fee</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.session_id}>
                        <td className="mono">
                          {s.session_id.slice(0, 8)}...
                        </td>
                        <td>{s.zone_id}</td>
                        <td>
                          {new Date(s.entry_timestamp).toLocaleString()}
                        </td>
                        <td>
                          {s.exit_timestamp
                            ? new Date(s.exit_timestamp).toLocaleString()
                            : "—"}
                        </td>
                        <td>
                          {s.duration_minutes != null
                            ? `${s.duration_minutes} min`
                            : "—"}
                        </td>
                        <td>
                          {s.base_fee != null
                            ? `${s.base_fee.toLocaleString()}`
                            : "—"}
                        </td>
                        <td>
                          {s.overstay_penalty != null
                            ? `+${(
                                s.overstay_penalty + (s.repeat_penalty || 0)
                              ).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="bold">
                          {s.final_fee != null
                            ? `${s.final_fee.toLocaleString()} HUF`
                            : "—"}
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
          )}
        </>
      )}
    </div>
  );
}
