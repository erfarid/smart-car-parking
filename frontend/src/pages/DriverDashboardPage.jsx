import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";
import {
  BUDAPEST_DISTRICTS,
  getDistrictLabel,
  getDistrictPoint,
  sortDistricts,
} from "../utils/budapestDistricts";

const BUDAPEST_CENTER = [47.4979, 19.0402];

const CONGESTION_COLORS = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const WARNING_THRESHOLD = 10000;
const LEGAL_WARNING_THRESHOLD = 20000;

function normalizeDistrictId(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();

  if (!raw) return "";

  if (raw.startsWith("D")) {
    const numeric = raw.slice(1).replace(/\D/g, "");
    return numeric ? `D${numeric.padStart(2, "0")}` : "";
  }

  if (raw.startsWith("Z_")) {
    const numeric = raw.slice(2).replace(/\D/g, "");
    return numeric ? `D${numeric.padStart(2, "0")}` : "";
  }

  const numeric = raw.replace(/\D/g, "");
  if (numeric) {
    return `D${numeric.padStart(2, "0")}`;
  }

  return raw;
}

function getActiveCount(cData) {
  return Number(
    cData?.active_vehicles ??
      cData?.active_sessions ??
      cData?.session_count ??
      cData?.count ??
      0,
  );
}

function getDistrictLevel(activeCount) {
  const count = Number(activeCount || 0);
  if (count <= 3) return "low";
  if (count <= 7) return "medium";
  return "high";
}

function getDistrictColor(activeCount) {
  const count = Number(activeCount || 0);
  if (count <= 3) return "#22c55e";
  if (count <= 7) return "#f59e0b";
  return "#ef4444";
}

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [plateNumber, setPlateNumber] = useState("");
  const [vehicle, setVehicle] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const [paymentMsg, setPaymentMsg] = useState(null);
  const [payingSession, setPayingSession] = useState(null);
  const [penaltyInfo, setPenaltyInfo] = useState(null);

  const [congestion, setCongestion] = useState([]);
  const [zones, setZones] = useState([]);
  const [myVehicles, setMyVehicles] = useState([]);
  const [userDistrictSessionCounts, setUserDistrictSessionCounts] = useState(
    {},
  );

  useEffect(() => {
    if (!user?.role) return;

    loadMapData();
    if (!isAdmin) {
      loadMyVehicles();
    }
  }, [isAdmin, user?.role, user?.user_id]);

  useEffect(() => {
    const refreshMap = () => {
      if (user?.role) {
        loadMapData();
      }
    };

    const intervalId = window.setInterval(refreshMap, 15000);
    window.addEventListener("focus", refreshMap);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshMap);
    };
  }, [isAdmin, user?.role, user?.user_id]);

  async function loadMapData() {
    try {
      const requests = [ApiClient.getCongestion(), ApiClient.listZones()];

      if (!isAdmin && user?.user_id) {
        requests.push(
          ApiClient.listSessions(
            null,
            null,
            user.user_id,
            user?.role || "user",
          ),
        );
      }

      const [c, z, userSessions = []] = await Promise.all(requests);

      setCongestion(Array.isArray(c) ? c : []);

      const cleanedZones = Array.isArray(z)
        ? z
            .filter((item) => {
              const normalized = normalizeDistrictId(item?.zone_id);
              return normalized.startsWith("D");
            })
            .map((item) => ({
              ...item,
              zone_id: normalizeDistrictId(item.zone_id),
            }))
        : [];

      setZones(sortDistricts(cleanedZones));

      if (!isAdmin) {
        const counts = (Array.isArray(userSessions) ? userSessions : []).reduce(
          (acc, session) => {
            const districtId = normalizeDistrictId(session?.zone_id);
            if (!districtId) return acc;
            acc[districtId] = (acc[districtId] || 0) + 1;
            return acc;
          },
          {},
        );
        setUserDistrictSessionCounts(counts);
      } else {
        setUserDistrictSessionCounts({});
      }
    } catch {
      setCongestion([]);
      setZones([]);
      setUserDistrictSessionCounts({});
    }
  }

  async function loadMyVehicles() {
    try {
      const vehicles = await ApiClient.listVehicles(
        user?.user_id || "",
        user?.role || "user",
      );
      setMyVehicles(vehicles);
      if (vehicles.length > 0) {
        const firstPlate = vehicles[0].plate_number;
        setPlateNumber(firstPlate);
        await lookupPlate(firstPlate);
      }
    } catch {
      setMyVehicles([]);
    }
  }

  async function lookupPlate(plate) {
    setLoading(true);
    setError(null);
    setVehicle(null);
    setSessions([]);
    setSearched(true);
    setPaymentMsg(null);
    setPenaltyInfo(null);

    try {
      const normalizedPlate = plate.trim().toUpperCase();

      const v = await ApiClient.getVehicle(
        normalizedPlate,
        user?.user_id || "",
        user?.role || "user",
      );
      setVehicle(v);

      const filteredSessions = await ApiClient.listSessions(
        null,
        null,
        user?.user_id || "",
        user?.role || "user",
        normalizedPlate,
      );
      setSessions(filteredSessions);

      await checkPenaltyStatus(normalizedPlate);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLookup(e) {
    e.preventDefault();
    if (!plateNumber.trim()) return;
    lookupPlate(plateNumber);
  }

  async function checkPenaltyStatus(plate) {
    try {
      const result = await ApiClient.checkPenalty(
        plate,
        user?.user_id || "",
        user?.role || "user",
      );
      setPenaltyInfo(result);
    } catch {
      setPenaltyInfo(null);
    }
  }

  async function handlePaySession(sessionId) {
    setPayingSession(sessionId);
    setPaymentMsg(null);

    try {
      await ApiClient.paySessions(
        [sessionId],
        user?.user_id || "",
        "Dashboard User",
        "0000",
        user?.role || "user",
      );

      setPaymentMsg({
        type: "success",
        text: `Payment successful for session ${sessionId.slice(0, 8)}...`,
      });

      await lookupPlate(plateNumber.trim().toUpperCase());
      await loadMapData();
    } catch (e) {
      setPaymentMsg({ type: "error", text: e.message });
    } finally {
      setPayingSession(null);
    }
  }

  async function handlePayAll() {
    setPaymentMsg(null);

    try {
      const result = await ApiClient.payAllByPlate(
        plateNumber.trim().toUpperCase(),
        user?.user_id || "",
        "Dashboard User",
        "0000",
        user?.role || "user",
      );

      setPaymentMsg({
        type: "success",
        text: `All unpaid sessions cleared! Total paid: ${result.total_paid.toLocaleString()} HUF`,
      });

      await lookupPlate(plateNumber.trim().toUpperCase());
      await loadMapData();
    } catch (e) {
      setPaymentMsg({ type: "error", text: e.message });
    }
  }

  const activeSessions = sessions.filter((s) => s.status === "active");
  const unpaidSessions = sessions.filter(
    (s) => s.status === "unpaid" || s.status === "overdue",
  );

  const totalFees = sessions.reduce(
    (sum, s) => sum + (s.final_fee || s.estimated_final_fee || 0),
    0,
  );

  const totalUnpaid = unpaidSessions.reduce(
    (sum, s) => sum + (s.final_fee || 0),
    0,
  );

  const congestionMap = {};
  congestion.forEach((c) => {
    const normalizedKey = normalizeDistrictId(c?.zone_id);
    if (normalizedKey) {
      congestionMap[normalizedKey] = c;
    }

    const rawKey = String(c?.zone_id || "")
      .trim()
      .toUpperCase();
    if (rawKey) {
      congestionMap[rawKey] = c;
    }
  });

  const districtMarkers =
    zones.length > 0
      ? zones
      : Object.entries(BUDAPEST_DISTRICTS).map(([zone_id, data]) => ({
          zone_id: normalizeDistrictId(zone_id),
          zone_name: data.label,
        }));

  return (
    <div className="page">
      <h1>{isAdmin ? "Driver View" : "Driver Dashboard"}</h1>

      <div className="card">
        <h2>Budapest District Activity Map</h2>
        <p className="text-muted">
          {isAdmin
            ? "Each district is shown as a marker on the Budapest map. Marker color changes with the number of active parking sessions in that district."
            : "Each district is shown as a marker on the Budapest map. Marker color changes when you have more sessions in that district, so districts with more than 3 of your sessions are highlighted automatically."}
        </p>

        <div className="map-container">
          <MapContainer
            center={BUDAPEST_CENTER}
            zoom={12}
            style={{ height: "400px", width: "100%", borderRadius: "8px" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {districtMarkers.map((zone) => {
              const normalizedZoneId = normalizeDistrictId(zone.zone_id);
              const district = getDistrictPoint(
                normalizedZoneId,
                zone.zone_name,
              );
              const cData =
                congestionMap[normalizedZoneId] ||
                congestionMap[
                  String(zone.zone_id || "")
                    .trim()
                    .toUpperCase()
                ];
              const activeCount = getActiveCount(cData);
              const userSessionCount =
                userDistrictSessionCounts[normalizedZoneId] || 0;
              const markerCount = isAdmin ? activeCount : userSessionCount;
              const level = getDistrictLevel(markerCount);
              const color = getDistrictColor(markerCount);

              return (
                <CircleMarker
                  key={`${normalizedZoneId}-${level}-${markerCount}`}
                  center={[district.lat, district.lng]}
                  radius={12 + Math.min(markerCount, 8)}
                  pathOptions={{
                    color,
                    fillColor: color,
                    weight: 3,
                    opacity: 0.95,
                    fillOpacity: 0.7,
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <strong>{getDistrictLabel(zone)}</strong>
                      <br />
                      {isAdmin ? (
                        <>
                          <span>Active sessions: {activeCount}</span>
                          <br />
                          <span>
                            Activity level:{" "}
                            <span style={{ color, fontWeight: 700 }}>
                              {level}
                            </span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span>Your sessions here: {userSessionCount}</span>
                          <br />
                          <span>Active sessions now: {activeCount}</span>
                          <br />
                          <span>
                            Your district level:{" "}
                            <span style={{ color, fontWeight: 700 }}>
                              {level}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <div className="map-legend">
          <div className="map-legend__item">
            <span
              className="map-legend__dot"
              style={{ background: CONGESTION_COLORS.low }}
            />{" "}
            {isAdmin ? "Low activity (0-3 active)" : "0-3 of your sessions"}
          </div>
          <div className="map-legend__item">
            <span
              className="map-legend__dot"
              style={{ background: CONGESTION_COLORS.medium }}
            />{" "}
            {isAdmin ? "Medium activity (4-7 active)" : "4-7 of your sessions"}
          </div>
          <div className="map-legend__item">
            <span
              className="map-legend__dot"
              style={{ background: CONGESTION_COLORS.high }}
            />{" "}
            {isAdmin ? "High activity (8+ active)" : "8+ of your sessions"}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>{isAdmin ? "Look Up Vehicle" : "Look Up Your Vehicle"}</h2>

        <form onSubmit={handleLookup} className="form-row">
          {isAdmin ? (
            <input
              type="text"
              placeholder="Enter plate number (e.g. ABC-1234)"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              className="input"
            />
          ) : myVehicles.length > 0 ? (
            <select
              className="input"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
            >
              {myVehicles.map((v) => (
                <option key={v.plate_number} value={v.plate_number}>
                  {v.plate_number} — {v.owner_name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value="No registered vehicle yet"
              disabled
            />
          )}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || (!plateNumber && !isAdmin)}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {!isAdmin && myVehicles.length === 0 && (
          <p className="text-muted" style={{ marginTop: "0.75rem" }}>
            Upload your car image first to register a vehicle to your account.
          </p>
        )}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {searched && !loading && !error && !vehicle && (
        <div className="alert alert--warning">
          No vehicle found for this account with plate "
          {plateNumber.toUpperCase()}".
        </div>
      )}

      {penaltyInfo?.penalty_warning && (
        <div
          className={`alert ${penaltyInfo.legal_warning ? "alert--error" : "alert--warning"} penalty-alert`}
        >
          <strong>
            {penaltyInfo.legal_warning ? "SECOND WARNING" : "FIRST WARNING"}
          </strong>
          <p>{penaltyInfo.message}</p>

          {isAdmin ? (
            totalUnpaid > 0 && (
              <button
                className="btn btn--primary"
                onClick={handlePayAll}
                style={{ marginTop: "12px" }}
              >
                Pay Now - {penaltyInfo.total_unpaid.toLocaleString()} HUF
              </button>
            )
          ) : (
            <p className="text-muted" style={{ marginTop: "0.75rem" }}>
              Go to the Payment page to submit your demo card details and clear
              the amount.
            </p>
          )}
        </div>
      )}

      {paymentMsg && (
        <div className={`alert alert--${paymentMsg.type}`}>
          {paymentMsg.text}
        </div>
      )}

      {vehicle && (
        <>
          <div className="card">
            <h2>Vehicle Information</h2>

            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Plate Number</span>
                <span className="detail-value mono bold">
                  {vehicle.plate_number}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Owner</span>
                <span className="detail-value">{vehicle.owner_name}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Vehicle Type</span>
                <span className="detail-value">{vehicle.vehicle_type}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Payment Status</span>
                <span className="detail-value">
                  {totalUnpaid > 0 ? (
                    <span className="badge badge--unpaid">
                      Unpaid - {totalUnpaid.toLocaleString()} HUF
                    </span>
                  ) : (
                    <span className="badge badge--paid">All Paid</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="card-grid">
            <div className="stat-card stat-card--info">
              <div className="stat-card__label">Total Sessions</div>
              <div className="stat-card__value">{sessions.length}</div>
            </div>

            <div className="stat-card stat-card--active">
              <div className="stat-card__label">Active Now</div>
              <div className="stat-card__value">{activeSessions.length}</div>
            </div>

            <div className="stat-card stat-card--warning">
              <div className="stat-card__label">Unpaid</div>
              <div className="stat-card__value">{unpaidSessions.length}</div>
            </div>

            <div className="stat-card stat-card--revenue">
              <div className="stat-card__label">Total Fees</div>
              <div className="stat-card__value">
                {totalFees.toLocaleString()} HUF
              </div>
            </div>
          </div>

          {unpaidSessions.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2>Unpaid Sessions ({unpaidSessions.length})</h2>

                {isAdmin ? (
                  <button className="btn btn--primary" onClick={handlePayAll}>
                    Pay All ({totalUnpaid.toLocaleString()} HUF)
                  </button>
                ) : (
                  <span className="text-muted">Pay from Payment page</span>
                )}
              </div>

              {totalUnpaid >= WARNING_THRESHOLD && (
                <div
                  className={`alert ${totalUnpaid >= LEGAL_WARNING_THRESHOLD ? "alert--error" : "alert--warning"}`}
                  style={{ marginTop: "12px" }}
                >
                  {totalUnpaid >= LEGAL_WARNING_THRESHOLD
                    ? `Second warning: your unpaid amount has reached ${totalUnpaid.toLocaleString()} HUF. Hungarian parking regulation notices now apply.`
                    : `First warning: your unpaid amount has reached ${totalUnpaid.toLocaleString()} HUF.`}
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>District</th>
                      <th>Entry</th>
                      <th>Duration</th>
                      <th>Fee</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {unpaidSessions.map((s) => (
                      <tr key={s.session_id}>
                        <td className="mono">{s.session_id.slice(0, 8)}...</td>
                        <td>{getDistrictLabel(s.zone_id)}</td>
                        <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                        <td>
                          {s.duration_minutes != null
                            ? `${s.duration_minutes} min`
                            : "-"}
                        </td>
                        <td className="bold">
                          {s.final_fee != null
                            ? `${s.final_fee.toLocaleString()} HUF`
                            : s.estimated_final_fee != null
                              ? `${s.estimated_final_fee.toLocaleString()} HUF (current)`
                              : "-"}
                        </td>
                        <td>
                          <span className={`badge badge--${s.status}`}>
                            {s.status}
                          </span>
                        </td>
                        <td>
                          {isAdmin ? (
                            <button
                              className="btn btn--sm btn--primary"
                              onClick={() => handlePaySession(s.session_id)}
                              disabled={payingSession === s.session_id}
                            >
                              {payingSession === s.session_id
                                ? "Processing..."
                                : "Pay"}
                            </button>
                          ) : (
                            <span className="text-muted">
                              Pay from Payment page
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSessions.length > 0 && (
            <div className="card">
              <h2>Currently Parked</h2>

              {!isAdmin && (
                <p className="text-muted" style={{ marginBottom: "0.75rem" }}>
                  Running sessions are ended from the Payment page after you
                  submit the demo card form.
                </p>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>District</th>
                      <th>Entry Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {activeSessions.map((s) => (
                      <tr key={s.session_id}>
                        <td className="mono">{s.session_id.slice(0, 8)}...</td>
                        <td>{getDistrictLabel(s.zone_id)}</td>
                        <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                        <td>
                          <span className="badge badge--active">Active</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="card">
              <h2>{isAdmin ? "Parking History" : "My Parking History"}</h2>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>District</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Duration</th>
                      <th>Base Fee</th>
                      <th>Penalties</th>
                      <th>Final Fee</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.session_id}>
                        <td className="mono">{s.session_id.slice(0, 8)}...</td>
                        <td>{getDistrictLabel(s.zone_id)}</td>
                        <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
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
                        <td>
                          {s.base_fee != null
                            ? `${s.base_fee.toLocaleString()}`
                            : "-"}
                        </td>
                        <td>
                          {s.overstay_penalty != null
                            ? `+${(s.overstay_penalty + (s.repeat_penalty || 0)).toLocaleString()}`
                            : "-"}
                        </td>
                        <td className="bold">
                          {s.final_fee != null
                            ? `${s.final_fee.toLocaleString()} HUF`
                            : s.estimated_final_fee != null
                              ? `${s.estimated_final_fee.toLocaleString()} HUF (current)`
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
        </>
      )}
    </div>
  );
}
