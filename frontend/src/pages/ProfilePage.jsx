import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";

function roleBadgeClass(role) {
  return role === "admin" || role === "worker" ? "active" : "paid";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isWorker = user?.role === "worker";
  const isStaff = isAdmin || isWorker;
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [notices, setNotices] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ recipientEmail: "", title: "", message: "" });

  useEffect(() => {
    loadProfile();
  }, [user?.user_id, user?.role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      if (isStaff) {
        const [p, sent] = await Promise.all([
          ApiClient.getUser(user.user_id),
          ApiClient.getSentMessages(user.user_id, user.role, 20),
        ]);
        setProfile(p);
        setSentMessages(sent);
        setPayments([]);
        setNotices([]);
      } else {
        const [p, pay, msg] = await Promise.all([
          ApiClient.getUser(user.user_id),
          ApiClient.getPaymentHistory(user.user_id),
          ApiClient.getNotices(user.user_id, user.role),
        ]);
        setProfile(p);
        setPayments(pay);
        setNotices(msg.slice(0, 4));
        setSentMessages([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    setSendError("");
    setSendSuccess("");
    setSending(true);
    try {
      await ApiClient.sendStaffMessage(
        user.user_id,
        form.recipientEmail,
        form.title || (isWorker ? "Worker message" : "Admin message"),
        form.message,
        user.role,
      );
      setSendSuccess(`Message sent to ${form.recipientEmail}.`);
      setForm({ recipientEmail: "", title: "", message: "" });
      const sent = await ApiClient.getSentMessages(user.user_id, user.role, 20);
      setSentMessages(sent);
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="page-loading">Loading profile...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  const stats = profile?.stats || {};

  return (
    <div className="page">
      <h1>{isAdmin ? "Admin Profile" : isWorker ? "Worker Profile" : "My Profile"}</h1>

      <div className="card">
        <div className="profile-header">
          <div className="profile-avatar">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <h2>{profile.name}</h2>
            <p className="text-muted" style={{ marginBottom: "4px" }}>{profile.email}</p>
            <span className={`badge badge--${roleBadgeClass(profile.role)}`}>
              {profile.role}
            </span>
          </div>
        </div>
      </div>

      {isStaff ? (
        <>
          <div className="card">
            <div className="card-header">
              <div>
                <h2 style={{ marginBottom: "0.35rem" }}>{isWorker ? "Send follow-up message to user" : "Send message to user"}</h2>
                <p className="text-muted">
                  Enter the user email and send a message. The user will receive it in the Messages section.
                </p>
              </div>
            </div>

            {sendSuccess && <div className="alert alert--success" style={{ marginBottom: "1rem" }}>{sendSuccess}</div>}
            {sendError && <div className="alert alert--error" style={{ marginBottom: "1rem" }}>{sendError}</div>}

            <form onSubmit={handleSendMessage} style={{ display: "grid", gap: "1rem" }}>
              <div className="form-group">
                <label>User email</label>
                <input
                  type="email"
                  value={form.recipientEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={isWorker ? "Patrol follow-up" : "Payment reminder"}
                />
              </div>

              <div className="form-group">
                <label>Message</label>
                <textarea
                  rows="5"
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Type the message you want to send to the user"
                  required
                />
              </div>

              <div>
                <button className="btn btn--primary" type="submit" disabled={sending}>
                  {sending ? "Sending..." : "Send message"}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 style={{ marginBottom: "0.35rem" }}>Recent sent messages</h2>
                <p className="text-muted">Latest messages you sent to users by email.</p>
              </div>
              <button className="btn btn--sm btn--outline" onClick={loadProfile}>Refresh</button>
            </div>

            {sentMessages.length === 0 ? (
              <p className="text-muted">No messages sent yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                {sentMessages.map((item) => (
                  <div key={item.message_id} className="card" style={{ background: "var(--color-surface-alt)" }}>
                    <div className="card-header">
                      <div>
                        <h3 style={{ marginBottom: "0.25rem" }}>{item.title}</h3>
                        <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                          To: {item.recipient_name ? `${item.recipient_name} (${item.recipient_email})` : item.recipient_email}
                        </div>
                      </div>
                      <span className="badge badge--active">sent</span>
                    </div>
                    <p style={{ margin: "0.75rem 0" }}>{item.message}</p>
                    <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="card-grid">
            <div className="stat-card stat-card--info">
              <div className="stat-card__label">Total Sessions</div>
              <div className="stat-card__value">{stats.total_sessions || 0}</div>
            </div>
            <div className="stat-card stat-card--active">
              <div className="stat-card__label">Active Sessions</div>
              <div className="stat-card__value">{stats.active_sessions || 0}</div>
            </div>
            <div className="stat-card stat-card--success">
              <div className="stat-card__label">Total Paid</div>
              <div className="stat-card__value">{(stats.total_paid || 0).toLocaleString()} HUF</div>
            </div>
            <div className="stat-card stat-card--danger">
              <div className="stat-card__label">Total Unpaid</div>
              <div className="stat-card__value">{(stats.total_unpaid || 0).toLocaleString()} HUF</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__label">Worker Fines</div>
              <div className="stat-card__value">{(stats.unpaid_worker_fines || 0).toLocaleString()} HUF</div>
            </div>
          </div>

          {notices.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2>Latest Messages</h2>
                <a href="/messages" className="btn btn--sm btn--outline">Open All</a>
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {notices.map((notice) => (
                  <div key={notice.notice_id} className={`alert alert--${notice.level === "error" ? "error" : notice.level === "warning" ? "warning" : "success"}`}>
                    <strong>{notice.title}</strong>
                    <div>{notice.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.fines && profile.fines.length > 0 && (
            <div className="card">
              <h2>Recent Worker Fines</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fine ID</th>
                      <th>Plate</th>
                      <th>Amount</th>
                      <th>Worker</th>
                      <th>Reason</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.fines.map((fine) => (
                      <tr key={fine.fine_id}>
                        <td className="mono">{fine.fine_id.slice(0, 8)}...</td>
                        <td className="mono bold">{fine.plate_number}</td>
                        <td className="bold">{fine.amount.toLocaleString()} HUF</td>
                        <td>{fine.worker_name}</td>
                        <td>{fine.reason}</td>
                        <td>{fine.issued_at ? new Date(fine.issued_at).toLocaleString() : "-"}</td>
                        <td><span className={`badge badge--${fine.status === "unpaid" ? "unpaid" : "paid"}`}>{fine.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {profile.vehicles && profile.vehicles.length > 0 && (
            <div className="card">
              <h2>My Vehicles</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Plate</th>
                      <th>Owner</th>
                      <th>Type</th>
                      <th>Registration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.vehicles.map((vehicle) => (
                      <tr key={vehicle.plate_number}>
                        <td className="mono bold">{vehicle.plate_number}</td>
                        <td>{vehicle.owner_name}</td>
                        <td>{vehicle.vehicle_type}</td>
                        <td>{vehicle.registration_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {payments.length > 0 && (
            <div className="card">
              <h2>Payment History</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Plate</th>
                      <th>Zone</th>
                      <th>Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.payment_id}>
                        <td className="mono">{payment.payment_id.slice(0, 8)}...</td>
                        <td className="mono bold">{payment.plate_number}</td>
                        <td>{payment.zone_id}</td>
                        <td className="bold">{payment.amount.toLocaleString()} HUF</td>
                        <td>{payment.payment_timestamp ? new Date(payment.payment_timestamp).toLocaleString() : "-"}</td>
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
