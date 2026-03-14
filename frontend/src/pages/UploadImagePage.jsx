import { useState } from "react";
import ApiClient from "../services/ApiClient";

export default function UploadImagePage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Quick-action state after successful detection
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [actionMsg, setActionMsg] = useState(null);

  // NEW: register vehicle state
  const [registerMsg, setRegisterMsg] = useState(null);
  const [manualPlate, setManualPlate] = useState("");
  const [registering, setRegistering] = useState(false);

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
      setActionMsg(null);
      setRegisterMsg(null);
      setManualPlate("");
      setSelectedZone("");
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setActionMsg(null);
    setRegisterMsg(null);

    try {
      const res = await ApiClient.uploadPlateImage(file);
      setResult(res);

      // prefill manual plate with detected text (even if invalid)
      setManualPlate((res.plate_text || "").toUpperCase());

      if (res.valid) {
        const z = await ApiClient.listZones();
        setZones(z);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterVehicle(plateText) {
    if (!plateText?.trim()) return;

    setRegistering(true);
    setRegisterMsg(null);

    try {
      const plate = plateText.trim().toUpperCase();
      await ApiClient.registerVehicle(plate);
      setRegisterMsg({ type: "success", text: `Vehicle "${plate}" registered in database.` });
    } catch (e) {
      setRegisterMsg({ type: "error", text: e.message });
    } finally {
      setRegistering(false);
    }
  }

  async function handleStartSession() {
    if (!selectedZone || !result?.plate_text) return;
    setActionMsg(null);

    try {
      const session = await ApiClient.createSession(result.plate_text, selectedZone);
      setActionMsg({
        type: "success",
        text: `Session started! ID: ${session.session_id.slice(0, 8)}... Entry: ${session.entry_timestamp}`,
      });
    } catch (e) {
      setActionMsg({ type: "error", text: e.message });
    }
  }

  return (
    <div className="page">
      <h1>Upload Plate Image</h1>

      {/* Upload Form */}
      <div className="card">
        <h2>License Plate Detection</h2>
        <p className="text-muted">
          Upload an image of a vehicle's license plate to detect the plate
          number using OCR.
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
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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

      {/* Detection Result */}
      {result && (
        <div className="card">
          <h2>Detection Result</h2>

          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Detected Plate</span>
              <span className="detail-value mono bold" style={{ fontSize: "1.5rem" }}>
                {result.plate_text || "No plate detected"}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Confidence</span>
              <span className="detail-value">
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Valid Format</span>
              <span className="detail-value">
                <span className={`badge badge--${result.valid ? "active" : "unpaid"}`}>
                  {result.valid ? "Yes" : "No"}
                </span>
              </span>
            </div>
          </div>

          {/* NEW: Vehicle Registration */}
          <div className="quick-action" style={{ marginTop: 16 }}>
            <h3>Vehicle Registration</h3>
            <div className="form-row">
              <input
                type="text"
                className="input"
                value={manualPlate}
                onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                placeholder="Enter plate manually (e.g., ABC-1234)"
              />
              <button
                className="btn btn--outline"
                onClick={() => handleRegisterVehicle(manualPlate)}
                disabled={registering || !manualPlate.trim()}
                type="button"
              >
                {registering ? "Saving..." : "Register Vehicle"}
              </button>
            </div>

            {registerMsg && (
              <div className={`alert alert--${registerMsg.type}`} style={{ marginTop: 10 }}>
                {registerMsg.text}
              </div>
            )}
          </div>

          {/* Quick Start Session */}
          {result.valid && (
            <div className="quick-action">
              <h3>Quick Action: Start Parking Session</h3>
              <div className="form-row">
                <input type="text" className="input" value={result.plate_text} disabled />
                <select
                  className="input"
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                >
                  <option value="">Select zone...</option>
                  {zones.map((z) => (
                    <option key={z.zone_id} value={z.zone_id}>
                      {z.zone_id} — {z.zone_name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--primary"
                  onClick={handleStartSession}
                  disabled={!selectedZone}
                  type="button"
                >
                  Start Session
                </button>
              </div>

              {actionMsg && (
                <div className={`alert alert--${actionMsg.type}`}>
                  {actionMsg.text}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}