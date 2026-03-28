import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";

const WARNING_THRESHOLD = 10000;
const LEGAL_WARNING_THRESHOLD = 20000;

const LEGAL_WARNINGS = [
  "Unpaid parking/session charges may result in a surcharge under Hungarian road transport law.",
  "If paid within 15 days, the surcharge is based on the fee for the chargeable parking period on that day plus two extra hours.",
  "If paid after 15 days, the surcharge can increase to 40 times the one-hour parking fee.",
  "The payment demand must generally be sent within 60 days.",
  "The fee/surcharge claim generally expires after 1 year.",
  "Default interest is not claimable on the fee/surcharge under this provision (NJT).",
];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function statusBadgeClass(status) {
  if (status === "paid") return "paid";
  if (status === "overdue") return "overdue";
  if (status === "unpaid") return "unpaid";
  return "active";
}

function AdminPaymentsView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getAdminPaymentRecords();
      setRecords(data);
    } catch (e) {
      setError(e.message || "Failed to load payment records");
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      if (!query) return true;
      return (
        (record.owner_name || "").toLowerCase().includes(query) ||
        (record.email || "").toLowerCase().includes(query)
      );
    });
  }, [records, search, statusFilter]);

  const stats = useMemo(() => ({
    active: records.filter((record) => record.status === "active").length,
    unpaid: records.filter((record) => record.status === "unpaid").length,
    overdue: records.filter((record) => record.status === "overdue").length,
    paid: records.filter((record) => record.status === "paid").length,
  }), [records]);

  if (loading) return <div className="page-loading">Loading payment records...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>Payment Management</h1>
        <button className="btn btn--outline" onClick={loadRecords}>Refresh</button>
      </div>

      <div className="card-grid">
        <div className="stat-card stat-card--active">
          <div className="stat-card__label">Active</div>
          <div className="stat-card__value">{stats.active}</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__label">Unpaid</div>
          <div className="stat-card__value">{stats.unpaid}</div>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card__label">Overdue</div>
          <div className="stat-card__value">{stats.overdue}</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__label">Paid</div>
          <div className="stat-card__value">{stats.paid}</div>
        </div>
      </div>

      <div className="card">
        <h2>Search and Filters</h2>
        <div className="form-row">
          <input
            type="text"
            className="input"
            placeholder="Search by owner name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Active Payments</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="all">All Statuses</option>
          </select>
          <button
            className="btn btn--outline"
            onClick={() => {
              setSearch("");
              setStatusFilter("active");
            }}
          >
            Clear
          </button>
        </div>
        <p className="text-muted" style={{ marginTop: "0.75rem" }}>
          Admin sees only active payment-related records by default. Search works for owner name and email.
        </p>
      </div>

      <div className="card">
        <h2>Payments ({filteredRecords.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>User Name (Owner)</th>
                <th>Email</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? filteredRecords.map((record) => (
                <tr key={`${record.payment_id}-${record.status}`}>
                  <td className="mono">{record.payment_id.slice(0, 8)}...</td>
                  <td className="bold">{record.owner_name || "-"}</td>
                  <td>{record.email || "-"}</td>
                  <td className="bold">{(record.amount || 0).toLocaleString()} HUF</td>
                  <td><span className={`badge badge--${statusBadgeClass(record.status)}`}>{record.status}</span></td>
                  <td>{formatDate(record.date)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="text-muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                    No payment records found for the current search/filter.
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

export default function PaymentPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const preferredPlate = location.state?.plateNumber?.trim().toUpperCase() || "";

  const [plateNumber, setPlateNumber] = useState(preferredPlate);
  const [myVehicles, setMyVehicles] = useState([]);
  const [unpaidData, setUnpaidData] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMode, setPaymentMode] = useState(null);

  const [receipt, setReceipt] = useState(null);
  const [penaltyInfo, setPenaltyInfo] = useState(null);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    if (!isAdmin) {
      loadMyVehicles();
      loadNotices();
    }
  }, [preferredPlate, isAdmin, user?.user_id, user?.role]);

  if (isAdmin) {
    return <AdminPaymentsView />;
  }

  async function loadNotices() {
    try {
      const data = await ApiClient.getNotices(user?.user_id || "", user?.role || "user");
      setNotices(data.slice(0, 3));
    } catch {
      setNotices([]);
    }
  }

  async function loadMyVehicles() {
    try {
      const vehicles = await ApiClient.listVehicles(user?.user_id || "", user?.role || "user");
      setMyVehicles(vehicles);
      if (vehicles.length > 0) {
        const preferredVehicle = vehicles.find((vehicle) => vehicle.plate_number === preferredPlate);
        const nextPlate = preferredVehicle?.plate_number || vehicles[0].plate_number;
        setPlateNumber(nextPlate);
        await loadPaymentData(nextPlate);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadPaymentData(plate) {
    if (!plate?.trim()) return;
    setLoading(true);
    setError(null);
    setReceipt(null);
    setPenaltyInfo(null);
    setSelectedSessions([]);

    try {
      const normalizedPlate = plate.trim().toUpperCase();
      const [unpaid, sessions] = await Promise.all([
        ApiClient.getUnpaidSessions(normalizedPlate, user?.user_id || "", user?.role || "user"),
        ApiClient.listSessions(null, null, user?.user_id || "", user?.role || "user", normalizedPlate),
      ]);
      setUnpaidData(unpaid);
      setActiveSessions(sessions.filter((session) => session.status === "active"));

      if (unpaid.total_unpaid >= WARNING_THRESHOLD) {
        const penalty = await ApiClient.checkPenalty(normalizedPlate, user?.user_id || "", user?.role || "user");
        setPenaltyInfo(penalty);
      }

      await loadNotices();
    } catch (e) {
      setError(e.message);
      setUnpaidData(null);
      setActiveSessions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleLookup(e) {
    e.preventDefault();
    await loadPaymentData(plateNumber);
  }

  function toggleSession(sessionId) {
    setSelectedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  }

  function selectAll() {
    if (!unpaidData) return;
    setSelectedSessions(unpaidData.sessions.map((session) => session.session_id));
  }

  const selectedTotal = useMemo(() => {
    if (!unpaidData) return 0;
    return unpaidData.sessions
      .filter((session) => selectedSessions.includes(session.session_id))
      .reduce((sum, session) => sum + (session.final_fee || 0), 0);
  }, [selectedSessions, unpaidData]);

  function openUnpaidPayment() {
    if (selectedSessions.length === 0) return;
    setPaymentMode({ type: "unpaid" });
    setShowCardForm(true);
  }

  function openCheckout(activeSession) {
    setPaymentMode({ type: "active", session: activeSession });
    setShowCardForm(true);
  }

  async function handlePayment(e) {
    e.preventDefault();
    if (!paymentMode) return;
    setProcessing(true);
    setError(null);

    try {
      const lastFour = cardNumber.replace(/\s/g, "").slice(-4);
      let result;

      if (paymentMode.type === "active") {
        result = await ApiClient.checkoutActiveSession(
          paymentMode.session.session_id,
          user?.user_id || "",
          cardName,
          lastFour,
          user?.role || "user"
        );
      } else {
        result = await ApiClient.paySessions(
          selectedSessions,
          user?.user_id || "",
          cardName,
          lastFour,
          user?.role || "user"
        );
      }

      setReceipt(result);
      setShowCardForm(false);
      setSelectedSessions([]);
      setPaymentMode(null);
      await loadPaymentData(plateNumber);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  }

  const amountToCharge = paymentMode?.type === "active"
    ? paymentMode.session?.estimated_final_fee || paymentMode.session?.final_fee || 0
    : selectedTotal;

  return (
    <div className="page">
      <h1>Payment</h1>

      <div className="card">
        <h2>My Vehicle Billing</h2>
        <form onSubmit={handleLookup} className="form-row">
          {myVehicles.length > 0 ? (
            <select className="input" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)}>
              {myVehicles.map((vehicle) => (
                <option key={vehicle.plate_number} value={vehicle.plate_number}>
                  {vehicle.plate_number} — {vehicle.owner_name}
                </option>
              ))}
            </select>
          ) : (
            <input className="input" value="No registered vehicle yet" disabled />
          )}
          <button type="submit" className="btn btn--primary" disabled={loading || !plateNumber}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </form>
        {myVehicles.length === 0 && (
          <p className="text-muted" style={{ marginTop: "0.75rem" }}>
            Register your vehicle from Upload Image first. After that, your own sessions and payments will appear here.
          </p>
        )}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {notices.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Latest Messages</h2>
            <a href="/messages" className="btn btn--sm btn--outline">Open Messages</a>
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

      {penaltyInfo && penaltyInfo.penalty_warning && !penaltyInfo.legal_warning && (
        <div className="alert alert--warning penalty-alert">
          <strong>FIRST WARNING</strong>
          <p>{penaltyInfo.message}</p>
        </div>
      )}

      {penaltyInfo && penaltyInfo.legal_warning && (
        <div className="alert alert--error penalty-alert">
          <strong>SECOND WARNING</strong>
          <p>{penaltyInfo.message}</p>
        </div>
      )}

      {unpaidData && unpaidData.total_unpaid > 0 && (
        <div className="alert alert--warning">
          <strong>Outstanding parking amount:</strong> {unpaidData.total_unpaid.toLocaleString()} HUF. Please pay to avoid more notices.
        </div>
      )}

      {unpaidData && unpaidData.total_unpaid >= LEGAL_WARNING_THRESHOLD && (
        <div className="card legal-notice">
          <h2>Legal Notice - Hungarian Parking Regulations</h2>
          <ul className="legal-list">
            {LEGAL_WARNINGS.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {receipt && (
        <div className="card receipt-card">
          <h2>Payment Receipt</h2>
          <div className="receipt-success">Payment Successful</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Total Paid</span>
              <span className="detail-value bold" style={{ fontSize: "1.4rem", color: "var(--color-success)" }}>
                {receipt.total_paid.toLocaleString()} HUF
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Sessions Paid</span>
              <span className="detail-value">{receipt.receipts.length}</span>
            </div>
          </div>
          {receipt.closed_session && (
            <div className="alert alert--success" style={{ marginTop: "1rem" }}>
              Session {receipt.closed_session.session_id.slice(0, 8)}... was ended automatically after payment submission.
            </div>
          )}
          <div className="table-wrap" style={{ marginTop: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Session ID</th>
                  <th>Plate</th>
                  <th>Amount</th>
                  <th>Date/Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {receipt.receipts.map((record) => (
                  <tr key={record.payment_id}>
                    <td className="mono">{record.payment_id.slice(0, 8)}...</td>
                    <td className="mono">{record.session_id.slice(0, 8)}...</td>
                    <td className="mono bold">{record.plate_number}</td>
                    <td className="bold">{record.amount.toLocaleString()} HUF</td>
                    <td>{formatDate(record.payment_timestamp)}</td>
                    <td><span className="badge badge--paid">Paid</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSessions.length > 0 && (
        <div className="card">
          <h2>Running Sessions - Pay to End</h2>
          <p className="text-muted" style={{ marginBottom: "0.75rem" }}>
            Normal users cannot end a session directly. Submit the card form below and the session will end automatically.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Zone</th>
                  <th>Entry</th>
                  <th>Current Amount</th>
                  <th>Warning</th>
                  <th>Current Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((session) => (
                  <tr key={session.session_id}>
                    <td className="mono">{session.session_id.slice(0, 8)}...</td>
                    <td>{session.zone_id}</td>
                    <td>{formatDate(session.entry_timestamp)}</td>
                    <td className="bold">{(session.estimated_final_fee || 0).toLocaleString()} HUF</td>
                    <td>
                      {(session.estimated_final_fee || 0) >= LEGAL_WARNING_THRESHOLD ? (
                        <span className="badge badge--overdue">20,000 HUF warning</span>
                      ) : (session.estimated_final_fee || 0) >= WARNING_THRESHOLD ? (
                        <span className="badge badge--unpaid">10,000 HUF warning</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td><span className="badge badge--active">Active</span></td>
                    <td>
                      <button className="btn btn--primary btn--sm" onClick={() => openCheckout(session)}>
                        Pay {(session.estimated_final_fee || 0).toLocaleString()} HUF & End
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {unpaidData && unpaidData.sessions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Unpaid Sessions ({unpaidData.sessions.length}) - Total: {unpaidData.total_unpaid.toLocaleString()} HUF</h2>
            <button className="btn btn--sm btn--outline" onClick={selectAll}>Select All</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Session ID</th>
                  <th>Zone</th>
                  <th>Entry</th>
                  <th>Duration</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unpaidData.sessions.map((session) => (
                  <tr key={session.session_id}>
                    <td>
                      <input type="checkbox" checked={selectedSessions.includes(session.session_id)} onChange={() => toggleSession(session.session_id)} />
                    </td>
                    <td className="mono">{session.session_id.slice(0, 8)}...</td>
                    <td>{session.zone_id}</td>
                    <td>{formatDate(session.entry_timestamp)}</td>
                    <td>{session.duration_minutes != null ? `${session.duration_minutes} min` : "-"}</td>
                    <td className="bold">{session.final_fee != null ? `${session.final_fee.toLocaleString()} HUF` : "-"}</td>
                    <td><span className={`badge badge--${session.status}`}>{session.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedSessions.length > 0 && (
            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <p className="bold" style={{ marginBottom: "8px" }}>
                Selected: {selectedSessions.length} session(s) - {selectedTotal.toLocaleString()} HUF
              </p>
              <button className="btn btn--primary btn--lg" onClick={openUnpaidPayment}>
                Proceed to Payment
              </button>
            </div>
          )}
        </div>
      )}

      {unpaidData && unpaidData.sessions.length === 0 && activeSessions.length === 0 && plateNumber && (
        <div className="alert alert--success">
          No active or unpaid sessions found for {plateNumber.toUpperCase()}.
        </div>
      )}

      {showCardForm && (
        <div className="card payment-form-card">
          <h2>Payment Details</h2>
          <p className="text-muted">Please complete the transaction. Parking is billed at 10 HUF/minute after the first 10 minutes, with a minimum fee of 50 HUF.</p>
          <form onSubmit={handlePayment} className="form-grid form-grid--2col">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Cardholder Name</label>
              <input type="text" className="input" placeholder="Name on card" value={cardName} onChange={(e) => setCardName(e.target.value)} required />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Card Number</label>
              <input type="text" className="input" placeholder="1234 5678 9012 3456" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} required maxLength={19} />
            </div>
            <div className="form-group">
              <label>Expiry Date</label>
              <input type="text" className="input" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} required maxLength={5} />
            </div>
            <div className="form-group">
              <label>CVV</label>
              <input type="text" className="input" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value)} required maxLength={4} />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <strong>
                {paymentMode?.type === "active"
                  ? `Submit payment of ${amountToCharge.toLocaleString()} HUF to end session ${paymentMode.session.session_id.slice(0, 8)}...`
                  : `Pay ${amountToCharge.toLocaleString()} HUF for selected unpaid sessions`}
              </strong>
            </div>
            <div className="form-group form-group--actions">
              <button type="submit" className="btn btn--primary btn--lg" disabled={processing}>
                {processing ? "Processing..." : `Submit Payment ${amountToCharge.toLocaleString()} HUF`}
              </button>
              <button type="button" className="btn btn--outline btn--lg" onClick={() => { setShowCardForm(false); setPaymentMode(null); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
