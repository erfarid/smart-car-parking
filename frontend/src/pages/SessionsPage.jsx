import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";
import { getDistrictLabel, sortDistricts } from "../utils/budapestDistricts";

export default function SessionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [sessions, setSessions] = useState([]);
  const [zones, setZones] = useState([]);
  const [userVehicles, setUserVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [newZone, setNewZone] = useState("");
  const [createMsg, setCreateMsg] = useState(null);
  const [creating, setCreating] = useState(false);

  const [closeMsg, setCloseMsg] = useState(null);

  useEffect(() => {
    loadData();
  }, [user?.user_id, user?.role]);

  // sessions, zones aur vehicles ek saath load karo
  async function loadData(filters = {}) {
    const nextDateFrom = filters.dateFrom ?? dateFrom;
    const nextDateTo = filters.dateTo ?? dateTo;

    setLoading(true);
    setError(null);

    try {
      const [sessionRows, zoneRows, vehicleRows] = await Promise.all([
        ApiClient.listSessions(
          nextDateFrom || null,
          nextDateTo || null,
          user?.user_id || "",
          user?.role || "user",
        ),
        ApiClient.listZones(),
        isAdmin
          ? Promise.resolve([])
          : ApiClient.listVehicles(user?.user_id || "", user?.role || "user"),
      ]);

      setSessions(Array.isArray(sessionRows) ? sessionRows : []);
      setZones(sortDistricts(Array.isArray(zoneRows) ? zoneRows : []));

      if (!isAdmin) {
        const vehicles = Array.isArray(vehicleRows) ? vehicleRows : [];
        setUserVehicles(vehicles);
        setNewPlate((currentPlate) => {
          if (
            currentPlate &&
            vehicles.some((vehicle) => vehicle.plate_number === currentPlate)
          ) {
            return currentPlate;
          }
          return vehicles[0]?.plate_number || "";
        });
      } else {
        setUserVehicles([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilter(e) {
    e.preventDefault();
    loadData();
  }

  // naya parking session start karne ka logic
  async function handleCreate(e) {
    e.preventDefault();
    setCreateMsg(null);

    if (!newPlate) {
      setCreateMsg({
        type: "error",
        text: "Please select a plate number first.",
      });
      return;
    }

    if (!newZone) {
      setCreateMsg({ type: "error", text: "Please select a district first." });
      return;
    }

    // agar already active session hai to dobara start mat hone do
    if (selectedActiveSession) {
      setCreateMsg({
        type: "error",
        text: `This vehicle already has an active session in ${getDistrictLabel(selectedActiveSession.zone_id)}. Open Payment to end it before starting a new one.`,
      });
      return;
    }

    setCreating(true);
    try {
      const result = await ApiClient.createSession(
        newPlate.toUpperCase(),
        newZone,
        null,
        user?.user_id || "",
        user?.role || "user",
      );
      setCreateMsg({
        type: "success",
        text: `Session ${result.session_id.slice(0, 8)}... created! Entry: ${new Date(result.entry_timestamp).toLocaleString()}`,
      });
      if (isAdmin) {
        setNewPlate("");
      }
      setNewZone("");
      await loadData();
    } catch (e) {
      setCreateMsg({ type: "error", text: e.message });
    } finally {
      setCreating(false);
    }
  }

  // session band karne ka function
  async function handleClose(sessionId) {
    setCloseMsg(null);
    try {
      const result = await ApiClient.closeSession(
        sessionId,
        null,
        user?.user_id || "",
        user?.role || "user",
      );
      setCloseMsg({
        type: "success",
        text: `Session closed! Fee: ${result.final_fee.toLocaleString()} HUF (base: ${result.base_fee.toLocaleString()}, overstay: ${result.overstay_penalty.toLocaleString()}, repeat: ${result.repeat_penalty.toLocaleString()})`,
      });
      loadData();
    } catch (e) {
      setCloseMsg({ type: "error", text: e.message });
    }
  }

  const selectedVehicle = useMemo(() => {
    return (
      userVehicles.find((vehicle) => vehicle.plate_number === newPlate) || null
    );
  }, [newPlate, userVehicles]);

  // check karo ki selected plate ka koi active session pehle se hai ya nahi
  const selectedActiveSession = useMemo(() => {
    return (
      sessions.find(
        (session) =>
          session.status === "active" && session.plate_number === newPlate,
      ) || null
    );
  }, [newPlate, sessions]);

  if (loading) return <div className="page-loading">Loading sessions...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  return (
    <div className="page">
      <h1>{isAdmin ? "Parking Sessions" : "My Parking Sessions"}</h1>

      {!isAdmin && (
        <div className="card">
          <div className="card-header">
            <h2>Start My Session</h2>
            <button
              className="btn btn--sm btn--outline"
              onClick={() => setShowCreate((prev) => !prev)}
              disabled={userVehicles.length === 0}
            >
              {showCreate ? "Cancel" : "New Session"}
            </button>
          </div>

          {userVehicles.length === 0 ? (
            <div className="alert alert--warning" style={{ marginTop: "1rem" }}>
              No vehicle is linked to your account yet. Add your vehicle first,
              then you can start parking sessions directly from this page.
            </div>
          ) : null}

          {showCreate && (
            <form onSubmit={handleCreate} className="form-grid">
              <div className="form-group">
                <label>Plate Number</label>
                <select
                  className="input"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  required
                >
                  <option value="">Select your car...</option>
                  {userVehicles.map((vehicle) => (
                    <option
                      key={vehicle.plate_number}
                      value={vehicle.plate_number}
                    >
                      {vehicle.plate_number} — {vehicle.vehicle_type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>District</label>
                <select
                  className="input"
                  value={newZone}
                  onChange={(e) => setNewZone(e.target.value)}
                  required
                >
                  <option value="">Select district...</option>
                  {zones.map((z) => (
                    <option key={z.zone_id} value={z.zone_id}>
                      {getDistrictLabel(z)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedVehicle && (
                <div
                  className="alert alert--success"
                  style={{ gridColumn: "1 / -1", margin: 0 }}
                >
                  Selected car: <strong>{selectedVehicle.plate_number}</strong>{" "}
                  · Owner: {selectedVehicle.owner_name} · Type:{" "}
                  {selectedVehicle.vehicle_type}
                </div>
              )}

              {selectedActiveSession && (
                <div
                  className="alert alert--warning"
                  style={{ gridColumn: "1 / -1", margin: 0 }}
                >
                  This car already has an active session in{" "}
                  <strong>
                    {getDistrictLabel(selectedActiveSession.zone_id)}
                  </strong>
                  .
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    style={{ marginLeft: "0.75rem" }}
                    onClick={() =>
                      navigate("/payment", {
                        state: {
                          plateNumber: selectedActiveSession.plate_number,
                        },
                      })
                    }
                  >
                    Open Payment
                  </button>
                </div>
              )}

              <div className="form-group">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={
                    creating ||
                    !newPlate ||
                    !newZone ||
                    userVehicles.length === 0 ||
                    Boolean(selectedActiveSession)
                  }
                >
                  {creating ? "Starting..." : "Start Parking"}
                </button>
              </div>
            </form>
          )}

          <p className="text-muted" style={{ marginTop: "0.75rem" }}>
            Choose any vehicle linked to your account, select a district, and
            start parking directly from here. Billing uses 10 HUF per minute
            after the first 10 minutes, with a minimum fee of 50 HUF. If one of
            your cars already has a running session, finish it from the Payment
            page first.
          </p>

          {createMsg && (
            <div className={`alert alert--${createMsg.type}`}>
              {createMsg.text}
            </div>
          )}
        </div>
      )}

      {closeMsg && (
        <div className={`alert alert--${closeMsg.type}`}>{closeMsg.text}</div>
      )}

      <div className="card">
        <h2>Filter Sessions</h2>
        <form onSubmit={handleFilter} className="form-row">
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From date"
          />
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To date"
          />
          <button type="submit" className="btn btn--primary">
            Filter
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              loadData({ dateFrom: "", dateTo: "" });
            }}
          >
            Clear
          </button>
        </form>
      </div>

      <div className="card">
        <h2>
          {isAdmin
            ? `All Sessions (${sessions.length})`
            : `My Sessions (${sessions.length})`}
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Plate</th>
                <th>District</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Duration</th>
                <th>Base Fee</th>
                <th>Overstay</th>
                <th>Repeat</th>
                <th>Final / Current Fee</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.session_id}>
                  <td className="mono">{s.session_id.slice(0, 8)}...</td>
                  <td className="mono bold">{s.plate_number}</td>
                  <td>{getDistrictLabel(s.zone_id)}</td>
                  <td>{new Date(s.entry_timestamp).toLocaleString()}</td>
                  <td>
                    {s.exit_timestamp
                      ? new Date(s.exit_timestamp).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    {s.duration_minutes != null
                      ? `${s.duration_minutes} min`
                      : "—"}
                  </td>
                  <td>
                    {s.base_fee != null ? s.base_fee.toLocaleString() : "—"}
                  </td>
                  <td>
                    {s.overstay_penalty != null
                      ? s.overstay_penalty.toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    {s.repeat_penalty != null
                      ? s.repeat_penalty.toLocaleString()
                      : "—"}
                  </td>
                  <td className="bold">
                    {s.final_fee != null
                      ? `${s.final_fee.toLocaleString()} HUF`
                      : s.estimated_final_fee != null
                        ? `${s.estimated_final_fee.toLocaleString()} HUF`
                        : "—"}
                  </td>
                  <td>
                    <span className={`badge badge--${s.status}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {isAdmin && s.status === "active" ? (
                      <button
                        className="btn btn--sm btn--danger"
                        onClick={() => handleClose(s.session_id)}
                      >
                        End Session
                      </button>
                    ) : s.status === "active" ? (
                      <button
                        className="btn btn--sm btn--outline"
                        onClick={() =>
                          navigate("/payment", {
                            state: {
                              plateNumber: selectedActiveSession.plate_number,
                            },
                          })
                        }
                      >
                        Go to Payment
                      </button>
                    ) : (
                      "—"
                    )}
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
