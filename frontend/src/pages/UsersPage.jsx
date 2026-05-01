import { useState, useEffect } from "react";
import ApiClient from "../services/ApiClient";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // search aur filter ke liye state
  const [searchName, setSearchName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchPlate, setSearchPlate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // selected user ka detail dikhane ke liye
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await ApiClient.getUsersSummary();
      setUsers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ek specific user ka pura detail load karo
  async function viewUser(userId) {
    setDetailLoading(true);
    setSelectedUser(userId);
    try {
      const data = await ApiClient.getUser(userId);
      setUserDetail(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedUser(null);
    setUserDetail(null);
  }

  // search aur filter logic
  const filtered = users.filter((u) => {
    if (searchName && !u.name.toLowerCase().includes(searchName.toLowerCase()))
      return false;
    if (
      searchEmail &&
      !u.email.toLowerCase().includes(searchEmail.toLowerCase())
    )
      return false;
    if (filterStatus === "unpaid" && u.total_unpaid <= 0) return false;
    if (filterStatus === "paid" && u.total_unpaid > 0) return false;
    return true;
  });

  if (loading) return <div className="page-loading">Loading users...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  // Detail view
  if (selectedUser && userDetail) {
    return (
      <div className="page">
        <div className="page-header-row">
          <h1>User Details</h1>
          <button className="btn btn--outline" onClick={closeDetail}>
            Back to Users
          </button>
        </div>

        {detailLoading ? (
          <div className="page-loading">Loading...</div>
        ) : (
          <>
            <div className="card">
              <div className="profile-header">
                <div className="profile-avatar">
                  {userDetail.name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-info">
                  <h2>{userDetail.name}</h2>
                  <p className="text-muted" style={{ marginBottom: "4px" }}>
                    {userDetail.email}
                  </p>
                  <span
                    className={`badge badge--${userDetail.role === "admin" || userDetail.role === "worker" ? "active" : "paid"}`}
                  >
                    {userDetail.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="card-grid">
              <div className="stat-card stat-card--info">
                <div className="stat-card__label">Total Sessions</div>
                <div className="stat-card__value">
                  {userDetail.stats.total_sessions}
                </div>
              </div>
              <div className="stat-card stat-card--active">
                <div className="stat-card__label">Active</div>
                <div className="stat-card__value">
                  {userDetail.stats.active_sessions}
                </div>
              </div>
              <div className="stat-card stat-card--success">
                <div className="stat-card__label">Total Paid</div>
                <div className="stat-card__value">
                  {userDetail.stats.total_paid.toLocaleString()} HUF
                </div>
              </div>
              <div className="stat-card stat-card--danger">
                <div className="stat-card__label">Total Unpaid</div>
                <div className="stat-card__value">
                  {userDetail.stats.total_unpaid.toLocaleString()} HUF
                </div>
              </div>
            </div>

            {/* user ke saare sessions */}
            {userDetail.sessions.length > 0 && (
              <div className="card">
                <h2>All Sessions ({userDetail.sessions.length})</h2>
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
                        <th>Fee</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userDetail.sessions.map((s) => (
                        <tr key={s.session_id}>
                          <td className="mono">
                            {s.session_id.slice(0, 8)}...
                          </td>
                          <td className="mono bold">{s.plate_number}</td>
                          <td>{s.zone_id}</td>
                          <td>
                            {new Date(s.entry_timestamp).toLocaleString()}
                          </td>
                          <td>
                            {s.exit_timestamp
                              ? new Date(s.exit_timestamp).toLocaleString()
                              : "-"}
                          </td>
                          <td>
                            {s.duration_minutes != null
                              ? `${s.duration_minutes} min`
                              : "-"}
                          </td>
                          <td className="bold">
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
            )}

            {/* user ke saare payments */}
            {userDetail.payments.length > 0 && (
              <div className="card">
                <h2>Payment History ({userDetail.payments.length})</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Payment ID</th>
                        <th>Session</th>
                        <th>Amount</th>
                        <th>Card</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userDetail.payments.map((p) => (
                        <tr key={p.payment_id}>
                          <td className="mono">
                            {p.payment_id.slice(0, 8)}...
                          </td>
                          <td className="mono">
                            {p.session_id.slice(0, 8)}...
                          </td>
                          <td className="bold">
                            {p.amount.toLocaleString()} HUF
                          </td>
                          <td>
                            {p.card_last_four ? `****${p.card_last_four}` : "-"}
                          </td>
                          <td>
                            {new Date(p.payment_timestamp).toLocaleString()}
                          </td>
                          <td>
                            <span className="badge badge--paid">
                              {p.status}
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

  // List view
  return (
    <div className="page">
      <h1>Users Management</h1>

      {/* Filters */}
      <div className="card">
        <h2>Search & Filter</h2>
        <div className="form-row">
          <input
            type="text"
            className="input"
            placeholder="Search by name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder="Search by email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
          />
          <select
            className="input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Users</option>
            <option value="unpaid">Has Unpaid Dues</option>
            <option value="paid">All Paid / Clear</option>
          </select>
          <button
            className="btn btn--outline"
            onClick={() => {
              setSearchName("");
              setSearchEmail("");
              setSearchPlate("");
              setFilterStatus("all");
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <h2>All Users ({filtered.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Sessions</th>
                <th>Paid</th>
                <th>Unpaid</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.user_id}>
                  <td className="bold">{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span
                      className={`badge badge--${u.role === "admin" || u.role === "worker" ? "active" : "paid"}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>{u.total_sessions}</td>
                  <td>{u.total_paid.toLocaleString()} HUF</td>
                  <td
                    className={u.total_unpaid > 0 ? "bold" : ""}
                    style={{
                      color:
                        u.total_unpaid > 0 ? "var(--color-danger)" : undefined,
                    }}
                  >
                    {u.total_unpaid > 0
                      ? `${u.total_unpaid.toLocaleString()} HUF`
                      : "-"}
                  </td>
                  <td>
                    {u.total_unpaid > 0 ? (
                      <span className="badge badge--unpaid">Unpaid</span>
                    ) : u.active_sessions > 0 ? (
                      <span className="badge badge--active">Active</span>
                    ) : (
                      <span className="badge badge--paid">Clear</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn--sm btn--outline"
                      onClick={() => viewUser(u.user_id)}
                    >
                      View
                    </button>
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
