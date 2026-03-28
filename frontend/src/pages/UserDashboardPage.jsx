import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ApiClient from "../services/ApiClient";
import { getDistrictLabel, sortDistricts } from "../utils/budapestDistricts";

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

function rememberPlate(email, plate) {
  const normalized = (plate || "").trim().toUpperCase();
  if (!normalized) return;

  try {
    const key = getPlateStorageKey(email);
    const current = JSON.parse(localStorage.getItem(key) || "[]");
    const next = Array.isArray(current) ? current : [];
    if (!next.includes(normalized)) {
      next.push(normalized);
      localStorage.setItem(key, JSON.stringify(next));
    }
    localStorage.setItem(`smartParkingLastPlate:${email || "guest"}`, normalized);
  } catch {
    // ignore local storage issues
  }
}

export default function UserDashboardPage() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);

  const [searchPlate, setSearchPlate] = useState("");
  const [vehicle, setVehicle] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);

  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(null);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const unpaidSessions = sessions.filter((s) => s.status === "unpaid");
  const totalFees = sessions.reduce((sum, s) => sum + (s.final_fee || 0), 0);
  const currentActiveSession = activeSessions[0] || null;

  useEffect(() => {
    let mounted = true;

    async function loadZones() {
      try {
        const zoneList = await ApiClient.listZones();
        if (mounted) setZones(sortDistricts(Array.isArray(zoneList) ? zoneList : []));
      } catch {
        if (mounted) setZones([]);
      } finally {
        if (mounted) setZonesLoading(false);
      }
    }

    loadZones();
    return () => {
      mounted = false;
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function loadVehicleData(plate) {
    const normalizedPlate = plate.trim().toUpperCase();
    const [foundVehicle, allSessions] = await Promise.all([
      ApiClient.getVehicle(normalizedPlate),
      ApiClient.listSessions(),
    ]);

    const relatedSessions = allSessions.filter(
      (session) => session.plate_number === normalizedPlate
    );

    return { foundVehicle, relatedSessions, normalizedPlate };
  }

  function setVehicleDetails(foundVehicle, relatedSessions, plate = "") {
    setVehicle(foundVehicle);
    setSessions(relatedSessions);
    setSearchPlate(plate || foundVehicle?.plate_number || "");
    setSessionMessage(null);
    rememberPlate(user?.email, plate || foundVehicle?.plate_number || "");
  }

  async function handlePlateSearch(e) {
    e.preventDefault();
    if (!searchPlate.trim()) return;

    setSearchLoading(true);
    setSearchError("");
    setSessionMessage(null);

    try {
      const { foundVehicle, relatedSessions, normalizedPlate } = await loadVehicleData(searchPlate);
      setVehicleDetails(foundVehicle, relatedSessions, normalizedPlate);
    } catch (error) {
      setVehicle(null);
      setSessions([]);
      setSearchError(error.message || "Unable to find vehicle");
    } finally {
      setSearchLoading(false);
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setUploadError("");
    setUploadResult(null);
    setSessionMessage(null);
  }

  async function handleImageSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setUploadLoading(true);
    setUploadError("");
    setUploadResult(null);
    setSessionMessage(null);

    try {
      const detection = await ApiClient.uploadPlateImage(file);
      setUploadResult(detection);

      if (detection?.plate_text) {
        const { foundVehicle, relatedSessions, normalizedPlate } = await loadVehicleData(
          detection.plate_text
        );
        setVehicleDetails(foundVehicle, relatedSessions, normalizedPlate);
      } else {
        setVehicle(null);
        setSessions([]);
      }
    } catch (error) {
      setVehicle(null);
      setSessions([]);
      setUploadError(error.message || "Unable to process image");
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleStartSession() {
    if (!vehicle?.plate_number || !selectedZone) return;

    setSessionLoading(true);
    setSessionMessage(null);

    try {
      const session = await ApiClient.createSession(vehicle.plate_number, selectedZone);
      const { foundVehicle, relatedSessions, normalizedPlate } = await loadVehicleData(
        vehicle.plate_number
      );
      setVehicleDetails(foundVehicle, relatedSessions, normalizedPlate);
      setSessionMessage({
        type: "success",
        text: `Parking session started successfully in ${getDistrictLabel(selectedZone)}. Session ID: ${session.session_id.slice(0, 8)}...`,
      });
    } catch (error) {
      setSessionMessage({
        type: "error",
        text: error.message || "Failed to start session",
      });
    } finally {
      setSessionLoading(false);
    }
  }

  function goToProfile() {
    navigate("/user/profile");
  }

  function goToPayment(session) {
    navigate("/user/payment", {
      state: {
        sessionId: session?.session_id,
        plateNumber: session?.plate_number || vehicle?.plate_number,
      },
    });
  }

  function handleLogout() {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <div className="page">
      <div className="user-hero card">
        <div>
          <p className="user-hero__eyebrow">User Dashboard</p>
          <h1>Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
          <p className="text-muted user-hero__text">
            Upload a vehicle image, or search by plate number below it, then choose the
            district where you want to start your parking session.
          </p>
        </div>

        <div className="user-hero__actions user-hero__actions--tight">
          <button type="button" className="landing__nav-btn landing__nav-btn--signin" onClick={handleLogout}>
            Logout
          </button>

          <button type="button" className="user-profile-card user-profile-card--button" onClick={goToProfile}>
            <div className="user-profile-card__avatar">
              {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="user-profile-card__title">Profile</div>
              <div className="user-profile-card__name">{user?.name || "User"}</div>
              <div className="user-profile-card__meta">{user?.email || "Signed in user"}</div>
            </div>
          </button>
        </div>
      </div>

      <div className="card user-panel">
        <div className="user-panel__header">
          <h2>Vehicle Upload</h2>
          <span className="badge badge--info">OCR Lookup</span>
        </div>
        <p className="text-muted">
          Upload a vehicle image. The detected plate will be checked and the same vehicle
          details will appear below. You can also search manually just under the upload area.
        </p>

        <form onSubmit={handleImageSubmit}>
          <div className="upload-area user-upload-area">
            <input
              id="user-plate-upload"
              type="file"
              accept="image/*"
              className="upload-input"
              onChange={handleFileChange}
            />
            <label htmlFor="user-plate-upload" className="upload-label">
              {preview ? (
                <img src={preview} alt="Vehicle preview" className="upload-preview" />
              ) : (
                <div className="upload-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Select an image to verify the vehicle</span>
                </div>
              )}
            </label>
          </div>

          <button
            className="btn btn--primary btn--lg"
            type="submit"
            disabled={!file || uploadLoading}
          >
            {uploadLoading ? "Checking image..." : "Upload and Verify"}
          </button>
        </form>

        {uploadError && <div className="alert alert--error">{uploadError}</div>}

        {uploadResult && (
          <div className="user-result-box">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Detected Plate</span>
                <span className="detail-value mono bold">
                  {uploadResult.plate_text || "No plate detected"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Confidence</span>
                <span className="detail-value">
                  {typeof uploadResult.confidence === "number"
                    ? `${(uploadResult.confidence * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Lookup Result</span>
                <span className="detail-value">
                  <span className={`badge badge--${vehicle ? "active" : "warning"}`}>
                    {vehicle ? "Vehicle Found" : "Not Found"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="inline-search-block">
          <div className="user-panel__header user-panel__header--compact">
            <h3>Search by Plate Number</h3>
            <span className="badge badge--revenue">Quick Search</span>
          </div>
          <form onSubmit={handlePlateSearch} className="form-row">
            <input
              type="text"
              className="input"
              placeholder="Enter plate number"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
            />
            <button className="btn btn--primary" type="submit" disabled={searchLoading}>
              {searchLoading ? "Searching..." : "Search Plate"}
            </button>
          </form>
          {searchError && <div className="alert alert--error">{searchError}</div>}
        </div>
      </div>

      {vehicle && (
        <div className="card user-panel">
          <div className="user-panel__header">
            <h2>Vehicle Details</h2>
            <span className="badge badge--active">Ready for Session</span>
          </div>

          <div className="detail-grid user-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Plate Number</span>
              <span className="detail-value mono bold">{vehicle.plate_number}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Owner</span>
              <span className="detail-value">{vehicle.owner_name || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Vehicle Type</span>
              <span className="detail-value">{vehicle.vehicle_type || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Registration</span>
              <span className="detail-value">
                <span className={`badge badge--${vehicle.registration_status === "active" ? "active" : "warning"}`}>
                  {vehicle.registration_status || "unknown"}
                </span>
              </span>
            </div>
          </div>

          <div className="card-grid user-stats-grid">
            <div className="stat-card stat-card--info">
              <div className="stat-card__label">Total Sessions</div>
              <div className="stat-card__value">{sessions.length}</div>
            </div>
            <div className="stat-card stat-card--active">
              <div className="stat-card__label">Active Sessions</div>
              <div className="stat-card__value">{activeSessions.length}</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__label">Unpaid Sessions</div>
              <div className="stat-card__value">{unpaidSessions.length}</div>
            </div>
            <div className="stat-card stat-card--revenue">
              <div className="stat-card__label">Total Fees</div>
              <div className="stat-card__value">{totalFees.toLocaleString()} HUF</div>
            </div>
          </div>

          <div className="quick-action user-start-session-box">
            <h3>Start Parking Session</h3>
            <p className="text-muted">
              Select the district where you want to park, then start the session for this vehicle.
            </p>
            <div className="form-row">
              <input type="text" className="input" value={vehicle.plate_number} disabled />
              <select
                className="input"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                disabled={zonesLoading}
              >
                <option value="">
                  {zonesLoading ? "Loading districts..." : "Select district"}
                </option>
                {zones.map((zone) => (
                  <option key={zone.zone_id} value={zone.zone_id}>
                    {getDistrictLabel(zone)}
                  </option>
                ))}
              </select>
              <button
                className="btn btn--primary"
                type="button"
                onClick={handleStartSession}
                disabled={!selectedZone || sessionLoading}
              >
                {sessionLoading ? "Starting..." : "Start Session"}
              </button>
            </div>

            {sessionMessage && (
              <div className={`alert alert--${sessionMessage.type}`}>
                {sessionMessage.text}
              </div>
            )}
          </div>

          {currentActiveSession && (
            <div className="quick-action user-start-session-box user-start-session-box--pay">
              <h3>Active Session Found</h3>
              <p className="text-muted">
                This vehicle already has an active session. Open the payment page to fill card details and end it.
              </p>
              <div className="form-row form-row--stack-mobile">
                <input className="input" disabled value={`Session: ${currentActiveSession.session_id.slice(0, 8)}...`} />
                <input className="input" disabled value={`District: ${getDistrictLabel(currentActiveSession.zone_id)}`} />
                <button className="btn btn--primary" type="button" onClick={() => goToPayment(currentActiveSession)}>
                  Go to Payment
                </button>
              </div>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="table-wrap user-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>District</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Duration</th>
                    <th>Final Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 5).map((session) => (
                    <tr key={session.session_id}>
                      <td className="mono">{session.session_id.slice(0, 8)}...</td>
                      <td>{getDistrictLabel(session.zone_id)}</td>
                      <td>{new Date(session.entry_timestamp).toLocaleString()}</td>
                      <td>
                        {session.exit_timestamp
                          ? new Date(session.exit_timestamp).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        {session.duration_minutes != null ? `${session.duration_minutes} min` : "—"}
                      </td>
                      <td>
                        {session.final_fee != null ? `${session.final_fee.toLocaleString()} HUF` : "—"}
                      </td>
                      <td>
                        <span className={`badge badge--${session.status}`}>
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
