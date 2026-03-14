import { useState, useEffect } from "react";
import ApiClient from "../services/ApiClient";

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Create session form
  const [showCreate, setShowCreate] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [newZone, setNewZone] = useState("");
  const [createMsg, setCreateMsg] = useState(null);

  // Close session
  const [closeMsg, setCloseMsg] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [s, z] = await Promise.all([
        ApiClient.listSessions(dateFrom || null, dateTo || null),
        ApiClient.listZones(),
      ]);
      setSessions(s);
      setZones(z);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilter(e) {
    e.preventDefault();
    loadData();
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateMsg(null);
    try {
      const result = await ApiClient.createSession(newPlate.toUpperCase(), newZone);
      setCreateMsg({
        type: "success",
        text: `Session ${result.session_id.slice(0, 8)}... created! Entry: ${result.entry_timestamp}`,
      });
      setNewPlate("");
      setNewZone("");
      loadData();
    } catch (e) {
      setCreateMsg({ type: "error", text: e.message });
    }
  }

  async function handleClose(sessionId) {
    setCloseMsg(null);
    try {
      const result = await ApiClient.closeSession(sessionId);
      setCloseMsg({
        type: "success",
        text: `Session closed! Fee: ${result.final_fee.toLocaleString()} HUF (base: ${result.base_fee.toLocaleString()}, overstay: ${result.overstay_penalty.toLocaleString()}, repeat: ${result.repeat_penalty.toLocaleString()})`,
      });
      loadData();
    } catch (e) {
      setCloseMsg({ type: "error", text: e.message });
    }
  }

  if (loading) return <div className="page-loading">Loading sessions...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  return (
    <div className="page">
      <h1>Parking Sessions</h1>

      {/* Create Session */}
      <div className="card">
        <div className="card-header">
          <h2>Start New Session</h2>
          <button
            className="btn btn--sm btn--outline"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? "Cancel" : "New Session"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="form-grid">
            <div className="form-group">
              <label>Plate Number</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. ABC-1234"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Zone</label>
              <select
                className="input"
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                required
              >
                <option value="">Select zone...</option>
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>
                    {z.zone_id} — {z.zone_name} ({z.base_hourly_rate} HUF/hr)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <button type="submit" className="btn btn--primary">
                Start Parking
              </button>
            </div>
          </form>
        )}

        {createMsg && (
          <div className={`alert alert--${createMsg.type}`}>
            {createMsg.text}
          </div>
        )}
      </div>

      {closeMsg && (
        <div className={`alert alert--${closeMsg.type}`}>{closeMsg.text}</div>
      )}

      {/* Filter */}
      <div className="card">
        <h2>Filter Sessions</h2>
        <form onSubmit={handleFilter} className="form-row">
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From date"
          />
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To date"
          />
          <button type="submit" className="btn btn--primary">
            Filter
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              loadData();
            }}
          >
            Clear
          </button>
        </form>
      </div>

      {/* Sessions Table */}
      <div className="card">
        <h2>All Sessions ({sessions.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Plate</th>
                <th>Zone</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Duration</th>
                <th>Base Fee</th>
                <th>Overstay</th>
                <th>Repeat</th>
                <th>Final Fee</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.session_id}>
                  <td className="mono">{s.session_id.slice(0, 8)}...</td>
                  <td className="mono bold">{s.plate_number}</td>
                  <td>{s.zone_id}</td>
                  <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
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
                    {s.base_fee != null ? s.base_fee.toLocaleString() : "—"}
                  </td>
                  <td>
                    {s.overstay_penalty != null
                      ? s.overstay_penalty.toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    {s.repeat_penalty != null
                      ? s.repeat_penalty.toLocaleString()
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
                  <td>
                    {s.status === "active" && (
                      <button
                        className="btn btn--sm btn--danger"
                        onClick={() => handleClose(s.session_id)}
                      >
                        End Session
                      </button>
                    )}
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
