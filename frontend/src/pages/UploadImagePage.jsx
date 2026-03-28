import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";
import { getDistrictLabel, sortDistricts } from "../utils/budapestDistricts";

const EMPTY_VEHICLE_FORM = {
  owner_name: "",
  vehicle_type: "car",
  registration_status: "active",
};

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString()} HUF`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function UploadImagePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [actionMsg, setActionMsg] = useState(null);

  const [vehicle, setVehicle] = useState(null);
  const [vehicleExists, setVehicleExists] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleSessions, setVehicleSessions] = useState([]);

  function resetVehicleState() {
    setVehicle(null);
    setVehicleExists(false);
    setVehicleDetails(null);
    setVehicleForm(EMPTY_VEHICLE_FORM);
    setVehicleSessions([]);
  }

  async function loadVehicleSessions(plate) {
    try {
      const sessions = await ApiClient.listSessions(
        null,
        null,
        user?.user_id || "",
        user?.role || "user",
        plate,
      );
      setVehicleSessions(sessions);
      return sessions;
    } catch {
      setVehicleSessions([]);
      return [];
    }
  }

  async function loadVehicleDetails(plate) {
    try {
      const details = await ApiClient.getVehicleDetails(
        plate,
        user?.user_id || "",
        user?.role || "user",
      );
      setVehicle(details.vehicle);
      setVehicleExists(true);
      setVehicleDetails(details);
      setVehicleSessions(details.sessions || []);
      return details;
    } catch {
      const fallbackVehicle = await ApiClient.getVehicle(
        plate,
        user?.user_id || "",
        user?.role || "user",
      );
      const fallbackSessions = await loadVehicleSessions(plate);
      setVehicle(fallbackVehicle);
      setVehicleExists(true);
      setVehicleDetails(null);
      return {
        vehicle: fallbackVehicle,
        sessions: fallbackSessions,
        payments: [],
      };
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError(null);
    setActionMsg(null);
    setSelectedZone("");
    resetVehicleState();
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setActionMsg(null);
    setSelectedZone("");
    resetVehicleState();

    try {
      const res = await ApiClient.uploadPlateImage(file);
      setResult(res);

      if (res.valid && res.plate_text) {
        const normalizedPlate = res.plate_text.toUpperCase();
        const [z, existingVehicle] = await Promise.all([
          ApiClient.listZones(),
          ApiClient.findVehicle(
            normalizedPlate,
            user?.user_id || "",
            user?.role || "user",
          ),
        ]);

        setZones(sortDistricts(Array.isArray(z) ? z : []));
        if (existingVehicle) {
          await loadVehicleDetails(normalizedPlate);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddVehicle(e) {
    e.preventDefault();
    if (!result?.plate_text || !vehicleForm.owner_name.trim()) return;

    setVehicleSaving(true);
    setActionMsg(null);

    try {
      await ApiClient.createVehicle({
        plate_number: result.plate_text.toUpperCase(),
        owner_name: vehicleForm.owner_name.trim(),
        vehicle_type: vehicleForm.vehicle_type,
        registration_status: vehicleForm.registration_status,
        owner_user_id: isAdmin ? "" : user?.user_id || "",
        requestor_role: user?.role || "user",
      });

      const saved = await loadVehicleDetails(result.plate_text.toUpperCase());
      const savedVehicle = saved.vehicle;
      setActionMsg({
        type: "success",
        text: isAdmin
          ? `Vehicle ${savedVehicle.plate_number} added successfully.`
          : `Vehicle ${savedVehicle.plate_number} is now linked to your account.`,
      });
    } catch (e) {
      setActionMsg({ type: "error", text: e.message });
    } finally {
      setVehicleSaving(false);
    }
  }

  async function handleStartSession() {
    if (!selectedZone || !result?.plate_text) return;
    setActionMsg(null);
    try {
      const session = await ApiClient.createSession(
        result.plate_text.toUpperCase(),
        selectedZone,
        null,
        user?.user_id || "",
        user?.role || "user",
      );
      setActionMsg({
        type: "success",
        text: `Session started! ID: ${session.session_id.slice(0, 8)}... Entry: ${new Date(session.entry_timestamp).toLocaleString()}`,
      });
      await loadVehicleDetails(result.plate_text.toUpperCase());
    } catch (e) {
      setActionMsg({ type: "error", text: e.message });
    }
  }

  const sessionSummary = vehicleDetails?.summary || {
    total_sessions: vehicleSessions.length,
    active_sessions: vehicleSessions.filter((s) => s.status === "active")
      .length,
    paid_sessions: vehicleSessions.filter((s) => s.status === "paid").length,
    unpaid_sessions: vehicleSessions.filter((s) => s.status === "unpaid")
      .length,
    overdue_sessions: vehicleSessions.filter((s) => s.status === "overdue")
      .length,
    total_paid_amount: vehicleSessions
      .filter((s) => s.status === "paid")
      .reduce((sum, s) => sum + (s.final_fee || 0), 0),
    total_unpaid_amount: vehicleSessions
      .filter((s) => s.status === "unpaid" || s.status === "overdue")
      .reduce((sum, s) => sum + (s.final_fee || 0), 0),
    active_estimated_amount: vehicleSessions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + (s.estimated_final_fee || 0), 0),
    payment_count: (vehicleDetails?.payments || []).length,
  };

  const ownerAccount = vehicleDetails?.owner || null;
  const recentSessions = vehicleSessions.slice(0, 6);
  const recentPayments = (vehicleDetails?.payments || []).slice(0, 5);
  const canShowVehicleActions = result?.valid && result?.plate_text;
  const activeCount = sessionSummary.active_sessions;
  const unpaidCount =
    sessionSummary.unpaid_sessions + sessionSummary.overdue_sessions;
  const paidCount = sessionSummary.paid_sessions;

  return (
    <div className="page">
      <h1>{isAdmin ? "Upload Plate Image" : "Upload Your Car Image"}</h1>

      <div className="card">
        <h2>License Plate Detection</h2>
        <p className="text-muted">
          {isAdmin
            ? "Upload an image of any vehicle plate to identify it and inspect the vehicle record."
            : "Upload your vehicle plate. If it is not linked to your account yet, you can register it here."}
        </p>

        <form onSubmit={handleUpload}>
          <div className="upload-area">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              id="plate-upload"
              className="upload-input"
            />
            <label htmlFor="plate-upload" className="upload-label">
              {preview ? (
                <img src={preview} alt="Preview" className="upload-preview" />
              ) : (
                <div className="upload-placeholder">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Click or drag to upload image</span>
                </div>
              )}
            </label>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--lg"
            disabled={!file || loading}
          >
            {loading ? "Processing..." : "Detect Plate"}
          </button>
        </form>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {result && (
        <div className="card">
          <h2>Detection Result</h2>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Detected Plate</span>
              <span
                className="detail-value mono bold"
                style={{ fontSize: "1.5rem" }}
              >
                {result.plate_text || "No plate detected"}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Confidence</span>
              <span className="detail-value">
                {((result.confidence || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Valid Format</span>
              <span className="detail-value">
                <span
                  className={`badge badge--${result.valid ? "active" : "unpaid"}`}
                >
                  {result.valid ? "Yes" : "No"}
                </span>
              </span>
            </div>
          </div>

          {canShowVehicleActions && (
            <>
              <div
                className="card"
                style={{
                  marginTop: "1rem",
                  boxShadow: "none",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                }}
              >
                <h3>
                  {isAdmin ? "Vehicle information" : "Vehicle Registration"}
                </h3>
                {vehicleExists && vehicle ? (
                  <>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Owner</span>
                        <span className="detail-value">
                          {vehicle.owner_name}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Vehicle Type</span>
                        <span
                          className="detail-value"
                          style={{ textTransform: "capitalize" }}
                        >
                          {vehicle.vehicle_type}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">
                          Registration Status
                        </span>
                        <span className="detail-value">
                          <span
                            className={`badge badge--${vehicle.registration_status === "active" ? "paid" : "unpaid"}`}
                          >
                            {vehicle.registration_status}
                          </span>
                        </span>
                      </div>
                      {ownerAccount && (
                        <>
                          <div className="detail-item">
                            <span className="detail-label">Linked User</span>
                            <span className="detail-value">
                              {ownerAccount.name}
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">User Email</span>
                            <span className="detail-value">
                              {ownerAccount.email}
                            </span>
                          </div>
                        </>
                      )}
                      {vehicle.owner_user_id && (
                        <div className="detail-item">
                          <span className="detail-label">Owner User ID</span>
                          <span className="detail-value mono">
                            {vehicle.owner_user_id}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="card-grid" style={{ marginTop: "1rem" }}>
                      <div className="stat-card stat-card--active">
                        <div className="stat-card__label">Active Sessions</div>
                        <div className="stat-card__value">{activeCount}</div>
                      </div>
                      <div className="stat-card stat-card--warning">
                        <div className="stat-card__label">Unpaid / Overdue</div>
                        <div className="stat-card__value">{unpaidCount}</div>
                      </div>
                      <div className="stat-card stat-card--success">
                        <div className="stat-card__label">Paid Sessions</div>
                        <div className="stat-card__value">{paidCount}</div>
                      </div>
                    </div>

                    <div className="detail-grid" style={{ marginTop: "1rem" }}>
                      <div className="detail-item">
                        <span className="detail-label">Total Paid Amount</span>
                        <span className="detail-value">
                          {formatMoney(sessionSummary.total_paid_amount)}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">
                          Total Unpaid Amount
                        </span>
                        <span className="detail-value">
                          {formatMoney(sessionSummary.total_unpaid_amount)}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">
                          Running Session Estimate
                        </span>
                        <span className="detail-value">
                          {formatMoney(sessionSummary.active_estimated_amount)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="card"
                      style={{
                        marginTop: "1rem",
                        boxShadow: "none",
                        border: "1px solid rgba(148, 163, 184, 0.2)",
                      }}
                    >
                      <h3>
                        {isAdmin
                          ? "Vehicle Session History"
                          : "Your Session History"}
                      </h3>
                      {recentSessions.length ? (
                        <div style={{ overflowX: "auto" }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Session</th>
                                <th>District</th>
                                <th>Status</th>
                                <th>Entry</th>
                                <th>Exit</th>
                                <th>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentSessions.map((session) => (
                                <tr key={session.session_id}>
                                  <td className="mono">
                                    {session.session_id.slice(0, 8)}...
                                  </td>
                                  <td>{getDistrictLabel(session.zone_id)}</td>
                                  <td>
                                    <span
                                      className={`badge badge--${session.status === "paid" ? "paid" : session.status === "active" ? "active" : "unpaid"}`}
                                    >
                                      {session.status}
                                    </span>
                                  </td>
                                  <td>{formatDate(session.entry_timestamp)}</td>
                                  <td>
                                    {session.exit_timestamp
                                      ? formatDate(session.exit_timestamp)
                                      : "Running"}
                                  </td>
                                  <td>
                                    {formatMoney(
                                      session.final_fee ??
                                        session.estimated_final_fee,
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-muted">
                          No sessions recorded for this vehicle yet.
                        </p>
                      )}
                    </div>

                    {recentPayments.length > 0 && (
                      <div
                        className="card"
                        style={{
                          marginTop: "1rem",
                          boxShadow: "none",
                          border: "1px solid rgba(148, 163, 184, 0.2)",
                        }}
                      >
                        <h3>Recent Payments</h3>
                        <div style={{ overflowX: "auto" }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Payment</th>
                                <th>Session</th>
                                <th>Amount</th>
                                <th>When</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentPayments.map((payment) => (
                                <tr key={payment.payment_id}>
                                  <td className="mono">
                                    {payment.payment_id.slice(0, 8)}...
                                  </td>
                                  <td className="mono">
                                    {payment.session_id.slice(0, 8)}...
                                  </td>
                                  <td>{formatMoney(payment.amount)}</td>
                                  <td>
                                    {formatDate(payment.payment_timestamp)}
                                  </td>
                                  <td>
                                    <span
                                      className={`badge badge--${payment.status === "success" ? "paid" : "unpaid"}`}
                                    >
                                      {payment.status}
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
                ) : (
                  <>
                    <div
                      className="alert alert--warning"
                      style={{ marginBottom: "1rem" }}
                    >
                      {isAdmin
                        ? "This plate is not in the vehicle database yet. Add it now so it can be managed in the system."
                        : "This plate is not linked to your account yet. Fill in the car details below to register it."}
                    </div>
                    <form onSubmit={handleAddVehicle}>
                      <div className="form-row">
                        <input
                          type="text"
                          className="input"
                          value={result.plate_text.toUpperCase()}
                          disabled
                        />
                        <input
                          type="text"
                          className="input"
                          placeholder="Owner name"
                          value={vehicleForm.owner_name}
                          onChange={(e) =>
                            setVehicleForm((prev) => ({
                              ...prev,
                              owner_name: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="form-row">
                        <select
                          className="input"
                          value={vehicleForm.vehicle_type}
                          onChange={(e) =>
                            setVehicleForm((prev) => ({
                              ...prev,
                              vehicle_type: e.target.value,
                            }))
                          }
                        >
                          <option value="car">Car</option>
                          <option value="motorcycle">Motorcycle</option>
                          <option value="van">Van</option>
                          <option value="truck">Truck</option>
                        </select>
                        <select
                          className="input"
                          value={vehicleForm.registration_status}
                          onChange={(e) =>
                            setVehicleForm((prev) => ({
                              ...prev,
                              registration_status: e.target.value,
                            }))
                          }
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                        <button
                          type="submit"
                          className="btn btn--primary"
                          disabled={
                            vehicleSaving || !vehicleForm.owner_name.trim()
                          }
                        >
                          {vehicleSaving
                            ? "Saving..."
                            : isAdmin
                              ? "Add Vehicle"
                              : "Register My Vehicle"}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>

              {vehicleExists &&
                (isAdmin ? (
                  <div className="quick-action">
                    <h3>Admin View</h3>
                    <div
                      className="alert alert--warning"
                      style={{ marginBottom: 0 }}
                    >
                      Admin can inspect scanned vehicle details here, but cannot
                      start a parking session from this page. Use the worker
                      flow for session creation.
                    </div>
                  </div>
                ) : (
                  <div className="quick-action">
                    <h3>Start My Parking Session</h3>
                    <div className="form-row">
                      <input
                        type="text"
                        className="input"
                        value={result.plate_text.toUpperCase()}
                        disabled
                      />
                      <select
                        className="input"
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                      >
                        <option value="">Select district...</option>
                        {zones.map((z) => (
                          <option key={z.zone_id} value={z.zone_id}>
                            {getDistrictLabel(z)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={handleStartSession}
                        disabled={!selectedZone}
                      >
                        Start Session
                      </button>
                    </div>
                    <p className="text-muted" style={{ marginTop: "0.75rem" }}>
                      Normal users cannot end a running session directly. To
                      finish it, go to Payment, enter demo card details, and
                      submit payment.
                    </p>
                  </div>
                ))}

              {actionMsg && (
                <div className={`alert alert--${actionMsg.type}`}>
                  {actionMsg.text}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
