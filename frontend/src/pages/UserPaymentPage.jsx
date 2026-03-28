import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ApiClient from "../services/ApiClient";
import { getDistrictLabel, sortDistricts } from "../utils/budapestDistricts";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getPaymentsKey(email) {
  return `smartParkingPayments:${email || "guest"}`;
}

const GLOBAL_PAYMENTS_KEY = "smartParkingPayments:all";

function upsertPaymentRecord(key, payment) {
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  const list = Array.isArray(current)
    ? current.filter((item) => item.session_id !== payment.session_id)
    : [];
  list.push(payment);
  localStorage.setItem(key, JSON.stringify(list));
}

function savePayment(email, payment) {
  try {
    upsertPaymentRecord(getPaymentsKey(email), payment);
    upsertPaymentRecord(GLOBAL_PAYMENTS_KEY, payment);
    localStorage.setItem("smartParkingPaymentsUpdatedAt", String(Date.now()));
  } catch {
    // ignore local storage issue
  }
}

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function validateForm(form) {
  const cardDigits = form.cardNumber.replace(/\D/g, "");
  const cvvDigits = form.cvv.replace(/\D/g, "");

  if (!form.cardName.trim()) return "Please enter the card holder name.";
  if (cardDigits.length !== 16) return "Card number must be 16 digits.";
  if (!/^\d{2}\/\d{2}$/.test(form.expiry)) return "Expiry must be in MM/YY format.";

  const [month] = form.expiry.split("/");
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) return "Enter a valid expiry month.";

  if (cvvDigits.length < 3 || cvvDigits.length > 4) return "CVV must be 3 or 4 digits.";
  return "";
}

function parseMinutes(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function isPeakMinute(date, zone) {
  const start = parseMinutes(zone?.peak_start);
  const end = parseMinutes(zone?.peak_end);
  if (start == null || end == null) return false;
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  return minuteOfDay >= start && minuteOfDay < end;
}

function calculateEstimatedFee(session, zone, allSessions) {
  if (!session?.entry_timestamp || !zone) {
    return { base_fee: 0, overstay_penalty: 0, repeat_penalty: 0, final_fee: Number(session?.final_fee || 0), duration_minutes: 0 };
  }

  const entryTime = new Date(session.entry_timestamp);
  const exitTime = session?.exit_timestamp ? new Date(session.exit_timestamp) : new Date();
  const duration_minutes = Math.max(0, Math.round((exitTime.getTime() - entryTime.getTime()) / 60000));
  const maxDuration = Number(zone.max_duration_minutes || 1440);
  const overstayMultiplier = Number(zone.overstay_multiplier || 1);
  const peakMultiplier = Math.min(1.3, Number(zone.peak_multiplier || 1));
  const baseRatePerMinute = Number(zone.base_hourly_rate || 0) / 60;

  let base_fee = 50;
  let overstay_penalty = 0;

  if (duration_minutes > 10) {
    let normalCharge = 0;
    let actualCharge = 0;

    for (let minuteOffset = 10; minuteOffset < duration_minutes; minuteOffset += 1) {
      const minuteTime = new Date(entryTime.getTime() + minuteOffset * 60000);
      let minuteRate = baseRatePerMinute;
      if (isPeakMinute(minuteTime, zone)) {
        minuteRate *= peakMultiplier;
      }

      normalCharge += minuteRate;
      actualCharge += minuteOffset >= maxDuration ? minuteRate * overstayMultiplier : minuteRate;
    }

    base_fee = Math.max(50, Math.round(normalCharge));
    overstay_penalty = Math.max(0, Math.round(actualCharge - normalCharge));
  }

  const repeat_count = allSessions.filter((item) => (
    item.plate_number === session.plate_number &&
    item.session_id !== session.session_id &&
    ["unpaid", "paid", "completed", "overdue"].includes(item.status)
  )).length;
  const repeat_penalty = Math.max(0, Math.round(base_fee * 0.2 * repeat_count));

  return {
    duration_minutes,
    base_fee,
    overstay_penalty,
    repeat_penalty,
    final_fee: base_fee + overstay_penalty + repeat_penalty,
  };
}
}

function formatDuration(minutes) {
  const total = Number(minutes || 0);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs <= 0) return `${mins} min`;
  return `${hrs}h ${mins}m`;
}

export default function UserPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [zones, setZones] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });

  const sessionId = location.state?.sessionId || "";
  const plateNumber = location.state?.plateNumber || "";

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (!sessionId && !plateNumber) {
        setError("No session selected for payment.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [sessionList, zoneList] = await Promise.all([
          ApiClient.listSessions(),
          ApiClient.listZones(),
        ]);
        const selected = sessionId
          ? sessionList.find((item) => item.session_id === sessionId)
          : sessionList.find((item) => item.plate_number === plateNumber && ["active", "unpaid", "overdue", "completed"].includes(item.status));

        if (!mounted) return;
        setAllSessions(Array.isArray(sessionList) ? sessionList : []);
        setZones(sortDistricts(Array.isArray(zoneList) ? zoneList : []));
        if (!selected) {
          setError("Active session not found.");
          setSession(null);
        } else {
          setSession(selected);
          setError("");
        }
      } catch (err) {
        if (mounted) setError(err.message || "Unable to load payment details");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSession();
    return () => {
      mounted = false;
    };
  }, [sessionId, plateNumber]);

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "cardNumber") {
      setForm((prev) => ({ ...prev, cardNumber: formatCardNumber(value) }));
      return;
    }

    if (name === "expiry") {
      setForm((prev) => ({ ...prev, expiry: formatExpiry(value) }));
      return;
    }

    if (name === "cvv") {
      setForm((prev) => ({ ...prev, cvv: value.replace(/\D/g, "").slice(0, 4) }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const zone = useMemo(
    () => zones.find((item) => item.zone_id === session?.zone_id),
    [zones, session?.zone_id]
  );
  const feePreview = useMemo(
    () => calculateEstimatedFee(session, zone, allSessions),
    [session, zone, allSessions]
  );
  const payableAmount = Number(
    session?.status === "paid"
      ? session?.final_fee ?? feePreview.final_fee
      : session?.final_fee ?? feePreview.final_fee
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!session?.session_id) {
      setError("No active session available for payment.");
      return;
    }

    setSubmitting(true);
    try {
      const closed = session?.status === "active"
        ? await ApiClient.closeSession(session.session_id)
        : session;
      const paidAt = new Date().toISOString();
      const cardLast4 = form.cardNumber.replace(/\D/g, "").slice(-4);
      const amount = Number(closed?.final_fee ?? session?.final_fee ?? payableAmount ?? 0);
      const paymentRecord = {
        session_id: session.session_id,
        plate_number: session.plate_number,
        zone_id: session.zone_id,
        entry_timestamp: session.entry_timestamp,
        amount,
        card_last4: cardLast4,
        paid_at: paidAt,
        status: "paid",
      };

      savePayment(user?.email, paymentRecord);

      setSuccess("Payment submitted successfully. This session is now marked as paid.");
      setSession({
        ...session,
        ...closed,
        status: "paid",
        final_fee: amount,
        paid_at: paidAt,
        card_last4: cardLast4,
      });

      setTimeout(() => {
        navigate("/user/profile");
      }, 1200);
    } catch (err) {
      setError(err.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--user-payment page--user-payment-light">
      <div className="card user-profile-page__hero payment-hero-light">
        <div>
          <p className="user-hero__eyebrow">Payment Page</p>
          <h1>Complete Your Payment</h1>
          <p className="text-muted user-hero__text">
            The payable amount is calculated at 10 HUF per minute after a 10-minute grace period, with a minimum fee of 50 HUF. After you submit the card form, the session will be marked as paid.
          </p>
        </div>
        <div className="profile-top-actions">
          <button type="button" className="btn btn--outline" onClick={() => navigate("/user/profile")}>Back to Profile</button>
        </div>
      </div>

      {loading ? (
        <div className="card user-panel"><p className="text-muted">Loading payment details...</p></div>
      ) : error && !session ? (
        <div className="card user-panel"><div className="alert alert--error">{error}</div></div>
      ) : (
        <div className="payment-layout">
          <div className="card user-panel payment-card-light">
            <div className="user-panel__header">
              <h2>Session Summary</h2>
              <span className={`badge ${session?.status === "paid" ? "badge--paid" : "badge--warning"}`}>
                {session?.status === "paid" ? "Paid" : "Payable"}
              </span>
            </div>
            <div className="detail-grid user-detail-grid">
              <div className="detail-item">
                <span className="detail-label">Email</span>
                <span className="detail-value">{user?.email || "—"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Plate Number</span>
                <span className="detail-value mono bold">{session?.plate_number || "—"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">District</span>
                <span className="detail-value">{getDistrictLabel(session?.zone_id) || "—"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Started At</span>
                <span className="detail-value">
                  {session?.entry_timestamp ? new Date(session.entry_timestamp).toLocaleString() : "—"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration</span>
                <span className="detail-value">{formatDuration(feePreview.duration_minutes)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">District Pricing</span>
                <span className="detail-value">Budapest district pricing is applied automatically.</span>
              </div>
            </div>

            <div className="payment-summary-box payment-summary-box--light">
              <div className="payment-summary-row">
                <span>Base Fee</span>
                <strong>{Number(feePreview.base_fee || 0).toLocaleString()} HUF</strong>
              </div>
              <div className="payment-summary-row">
                <span>Overstay Penalty</span>
                <strong>{Number(feePreview.overstay_penalty || 0).toLocaleString()} HUF</strong>
              </div>
              <div className="payment-summary-row">
                <span>Repeat Penalty</span>
                <strong>{Number(feePreview.repeat_penalty || 0).toLocaleString()} HUF</strong>
              </div>
              <div className="payment-summary-row payment-summary-row--total">
                <span>Total to Pay</span>
                <strong>{Number(payableAmount || 0).toLocaleString()} HUF</strong>
              </div>
              {session?.status === "paid" && (
                <div className="payment-status-note">Status updated successfully: <strong>Paid</strong></div>
              )}
            </div>
          </div>

          <div className="card user-panel payment-card-light">
            <div className="user-panel__header">
              <h2>Card Details</h2>
              <span className="badge badge--info">Payment Form</span>
            </div>
            <form onSubmit={handleSubmit} className="payment-form">
              <div className="auth-form__group auth-form__group--full">
                <label className="auth-form__label" htmlFor="cardName">Card Holder Name</label>
                <input
                  id="cardName"
                  className="auth-form__input payment-input-light"
                  name="cardName"
                  value={form.cardName}
                  onChange={handleChange}
                  placeholder="John Doe"
                  autoComplete="cc-name"
                />
              </div>

              <div className="auth-form__group auth-form__group--full">
                <label className="auth-form__label" htmlFor="cardNumber">Card Number</label>
                <input
                  id="cardNumber"
                  className="auth-form__input payment-input-light"
                  name="cardNumber"
                  value={form.cardNumber}
                  onChange={handleChange}
                  placeholder="1234 5678 9012 3456"
                  autoComplete="cc-number"
                  inputMode="numeric"
                />
              </div>

              <div className="payment-form__row">
                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="expiry">Expiry</label>
                  <input
                    id="expiry"
                    className="auth-form__input payment-input-light"
                    name="expiry"
                    value={form.expiry}
                    onChange={handleChange}
                    placeholder="MM/YY"
                    autoComplete="cc-exp"
                    inputMode="numeric"
                  />
                </div>
                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="cvv">CVV</label>
                  <input
                    id="cvv"
                    className="auth-form__input payment-input-light"
                    name="cvv"
                    value={form.cvv}
                    onChange={handleChange}
                    placeholder="123"
                    autoComplete="cc-csc"
                    inputMode="numeric"
                  />
                </div>
              </div>

              {error && <div className="alert alert--error">{error}</div>}
              {success && <div className="alert alert--success">{success}</div>}

              <button type="submit" className="btn btn--primary btn--lg payment-submit-light" disabled={submitting || session?.status === "paid"}>
                {session?.status === "paid"
                  ? "Paid"
                  : submitting
                    ? "Submitting Payment..."
                    : `Pay ${Number(payableAmount || 0).toLocaleString()} HUF`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
