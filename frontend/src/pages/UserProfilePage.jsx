import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ApiClient from "../services/ApiClient";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getPlateStorageKey(email) {
  return `smartParkingUserPlates:${email || "guest"}`;
}

function getPaymentsKey(email) {
  return `smartParkingPayments:${email || "guest"}`;
}

function readStoredPlates(email) {
  try {
    const data = JSON.parse(localStorage.getItem(getPlateStorageKey(email)) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function readPayments(email) {
  try {
    const data = JSON.parse(localStorage.getItem(getPaymentsKey(email)) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function mergePaymentState(session, payments) {
  const paidItem = payments.find((item) => item.session_id === session.session_id);
  if (!paidItem) return session;
  return {
    ...session,
    status: "paid",
    final_fee: paidItem.amount ?? session.final_fee,
    paid_at: paidItem.paid_at,
    card_last4: paidItem.card_last4,
  };
}

export default function UserProfilePage() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadProfileData() {
      setLoading(true);
      try {
        const allSessions = await ApiClient.listSessions();
        const plates = readStoredPlates(user?.email);
        const userPayments = readPayments(user?.email);
        const filtered = allSessions
          .filter((session) => plates.includes(session.plate_number))
          .map((session) => mergePaymentState(session, userPayments))
          .sort((a, b) => new Date(b.entry_timestamp) - new Date(a.entry_timestamp));

        if (mounted) {
          setSessions(filtered);
          setPayments(userPayments);
        }
      } catch {
        if (mounted) {
          setSessions([]);
          setPayments(readPayments(user?.email));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfileData();
    return () => {
      mounted = false;
    };
  }, [user?.email]);

  const activeSessions = sessions.filter((session) => session.status === "active");
  const paidSessions = sessions.filter((session) => session.status === "paid");
  const dueSessions = sessions.filter((session) => ["unpaid", "overdue", "completed"].includes(session.status));
  const totalDue = dueSessions.reduce((sum, item) => sum + (item.final_fee || 0), 0);

  return (
    <div className="page page--user-profile">
      <div className="card user-profile-page__hero">
        <div>
          <p className="user-hero__eyebrow">User Profile</p>
          <h1>{user?.name || "User Profile"}</h1>
          <p className="text-muted user-hero__text">
            Check your email, pending amount, active sessions, and the transaction history of payments you already made.
          </p>
        </div>
        <div className="profile-top-actions">
          <button type="button" className="btn btn--outline" onClick={() => navigate("/user")}>Back to Dashboard</button>
        </div>
      </div>

      <div className="card-grid user-stats-grid">
        <div className="stat-card stat-card--info">
          <div className="stat-card__label">Email</div>
          <div className="stat-card__value stat-card__value--small">{user?.email || "—"}</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__label">Amount to Pay</div>
          <div className="stat-card__value">{totalDue.toLocaleString()} HUF</div>
        </div>
        <div className="stat-card stat-card--active">
          <div className="stat-card__label">Paid Transactions</div>
          <div className="stat-card__value">{paidSessions.length}</div>
        </div>
        <div className="stat-card stat-card--revenue">
          <div className="stat-card__label">Active Sessions</div>
          <div className="stat-card__value">{activeSessions.length}</div>
        </div>
      </div>

      <div className="card user-panel">
        <div className="user-panel__header">
          <h2>Active Sessions</h2>
          <span className="badge badge--active">Live</span>
        </div>
        {loading ? (
          <p className="text-muted">Loading profile data...</p>
        ) : activeSessions.length === 0 ? (
          <p className="text-muted">No active sessions found for this user yet.</p>
        ) : (
          <div className="table-wrap user-history-table">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Plate</th>
                  <th>District</th>
                  <th>Started</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((session) => (
                  <tr key={session.session_id}>
                    <td className="mono">{session.session_id.slice(0, 8)}...</td>
                    <td>{session.plate_number}</td>
                    <td>{session.zone_id}</td>
                    <td>{new Date(session.entry_timestamp).toLocaleString()}</td>
                    <td>
                      <button
                        className="btn btn--primary btn--sm"
                        type="button"
                        onClick={() =>
                          navigate("/user/payment", {
                            state: { sessionId: session.session_id, plateNumber: session.plate_number },
                          })
                        }
                      >
                        Pay Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card user-panel">
        <div className="user-panel__header">
          <h2>Pending Payments</h2>
          <span className="badge badge--warning">Due</span>
        </div>
        {dueSessions.length === 0 ? (
          <p className="text-muted">No pending amount right now.</p>
        ) : (
          <div className="table-wrap user-history-table">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Plate</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dueSessions.map((session) => (
                  <tr key={session.session_id}>
                    <td className="mono">{session.session_id.slice(0, 8)}...</td>
                    <td>{session.plate_number}</td>
                    <td>{session.final_fee != null ? `${session.final_fee.toLocaleString()} HUF` : "—"}</td>
                    <td><span className={`badge badge--${session.status}`}>{session.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card user-panel">
        <div className="user-panel__header">
          <h2>Transaction History</h2>
          <span className="badge badge--revenue">Paid</span>
        </div>
        {payments.length === 0 ? (
          <p className="text-muted">No paid transactions yet.</p>
        ) : (
          <div className="table-wrap user-history-table">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Plate</th>
                  <th>Amount</th>
                  <th>Card</th>
                  <th>Paid At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments
                  .slice()
                  .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
                  .map((payment) => (
                    <tr key={payment.session_id}>
                      <td className="mono">{payment.session_id.slice(0, 8)}...</td>
                      <td>{payment.plate_number}</td>
                      <td>{payment.amount != null ? `${payment.amount.toLocaleString()} HUF` : "—"}</td>
                      <td>{payment.card_last4 ? `**** ${payment.card_last4}` : "—"}</td>
                      <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "—"}</td>
                      <td><span className="badge badge--paid">paid</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
