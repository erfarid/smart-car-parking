import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";

export default function MessagesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isWorker = user?.role === "worker";
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMessages();
  }, [user?.user_id, user?.role]);

  async function loadMessages() {
    setLoading(true);
    setError(null);
    try {
      const data = isWorker
        ? await ApiClient.getSentMessages(user?.user_id || "", user?.role || "worker", 50)
        : await ApiClient.getNotices(user?.user_id || "", user?.role || "user");
      setMessages(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="page-loading">Loading messages...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  return (
    <div className="page">
      <div className="card-header" style={{ marginBottom: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.35rem" }}>Messages</h1>
          <p className="text-muted">
            {isWorker
              ? "Messages sent by you to drivers after patrol checks."
              : isAdmin
                ? "System notices based on current active, unpaid, and overdue sessions."
                : "Your notices, staff messages, unpaid reminders, active-session amount updates, and worker fines."}
          </p>
        </div>
        <button className="btn btn--outline btn--sm" onClick={loadMessages}>Refresh</button>
      </div>

      {messages.length === 0 ? (
        <div className="card">
          <div className="alert alert--success">
            {isWorker
              ? "No sent messages yet."
              : isAdmin
                ? "No new system notices right now."
                : "No new messages. You have no active payment warnings right now."}
          </div>
        </div>
      ) : isWorker ? (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {messages.map((item) => (
            <div key={item.message_id} className="card" style={{ borderLeft: "4px solid var(--color-info)" }}>
              <div className="card-header">
                <div>
                  <h2 style={{ marginBottom: "0.25rem" }}>{item.title}</h2>
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
      ) : (
        <div className="card-grid">
          {messages.map((notice) => {
            const levelClass = notice.level === "error" ? "danger" : notice.level === "warning" ? "warning" : "info";
            const isDirectMessage = notice.source === "admin_message";
            const isWorkerFine = notice.source === "worker_fine";
            const amountValue = notice.amount ?? null;
            return (
              <div key={notice.notice_id} className="card" style={{ borderLeft: `4px solid var(--color-${levelClass})` }}>
                <div className="card-header">
                  <div>
                    <h2 style={{ marginBottom: "0.25rem" }}>{notice.title}</h2>
                    <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                      {isDirectMessage || isWorkerFine
                        ? `From: ${notice.sender_name || "System"}`
                        : notice.plate_number
                          ? `Plate: ${notice.plate_number}`
                          : "System message"}
                    </div>
                  </div>
                  <span className={`badge badge--${notice.level === "error" ? "overdue" : notice.level === "warning" ? "unpaid" : "active"}`}>
                    {isWorkerFine ? "fine" : isDirectMessage ? "staff" : notice.level}
                  </span>
                </div>
                <p style={{ margin: "0.75rem 0" }}>{notice.message}</p>
                <div className="detail-grid">
                  {amountValue !== null && amountValue !== undefined && (
                    <div className="detail-item">
                      <span className="detail-label">Amount</span>
                      <span className="detail-value bold">{amountValue.toLocaleString()} HUF</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Date</span>
                    <span className="detail-value">{notice.created_at ? new Date(notice.created_at).toLocaleString() : "-"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
