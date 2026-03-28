import { useEffect, useMemo, useState } from "react";
import ApiClient from "../services/ApiClient";

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadWorkers();
  }, []);

  async function loadWorkers() {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getUsersSummary("worker");
      setWorkers(data);
    } catch (e) {
      setError(e.message || "Failed to load workers");
    } finally {
      setLoading(false);
    }
  }

  const filteredWorkers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return workers;
    return workers.filter(
      (worker) =>
        (worker.name || "").toLowerCase().includes(query) ||
        (worker.email || "").toLowerCase().includes(query),
    );
  }, [workers, search]);

  if (loading) return <div className="page-loading">Loading workers...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>Workers Management</h1>
        <button className="btn btn--outline" onClick={loadWorkers}>
          Refresh
        </button>
      </div>

      <div className="card">
        <h2>Search Workers</h2>
        <div className="form-row">
          <input
            type="text"
            className="input"
            placeholder="Search by worker name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn--outline" onClick={() => setSearch("")}>
            Clear
          </button>
        </div>
      </div>

      <div className="card-grid">
        <div className="stat-card stat-card--info">
          <div className="stat-card__label">Total Workers</div>
          <div className="stat-card__value">{workers.length}</div>
        </div>
        <div className="stat-card stat-card--active">
          <div className="stat-card__label">Messages Sent</div>
          <div className="stat-card__value">
            {workers.reduce(
              (sum, worker) => sum + (worker.messages_sent || 0),
              0,
            )}
          </div>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card__label">Fines Issued</div>
          <div className="stat-card__value">
            {workers.reduce(
              (sum, worker) => sum + (worker.fines_issued || 0),
              0,
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>All Workers ({filteredWorkers.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Messages Sent</th>
                <th>Fines Issued</th>
                <th>Unpaid Fines</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.length > 0 ? (
                filteredWorkers.map((worker) => (
                  <tr key={worker.user_id}>
                    <td className="bold">{worker.name}</td>
                    <td>{worker.email}</td>
                    <td>
                      <span className="badge badge--active">{worker.role}</span>
                    </td>
                    <td>{worker.messages_sent || 0}</td>
                    <td>{worker.fines_issued || 0}</td>
                    <td>{worker.unpaid_fines_issued || 0}</td>
                    <td>
                      {worker.created_at
                        ? new Date(worker.created_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="text-muted"
                    style={{ textAlign: "center", padding: "1.5rem" }}
                  >
                    No workers found for this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
