import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/ApiClient";

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString()} HUF`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function buildDefaultNotice(scanResult) {
  if (!scanResult?.fine || !scanResult?.owner) return "";
  return (
    `Hello ${scanResult.owner.name},\n\n` +
    `During a parking patrol, your vehicle ${scanResult.vehicle?.plate_number || scanResult.plate_number} was inspected and no active parking session was found. ` +
    `A ${formatMoney(scanResult.fine.amount)} fine has been assigned. Please review the fine in the application and settle it as soon as possible.`
  );
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

export default function WorkerDashboardPage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [captureSource, setCaptureSource] = useState(null);
  const [note, setNote] = useState("");
  const [detection, setDetection] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noticeStatus, setNoticeStatus] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);

  useEffect(() => {
    loadHistory();
  }, [user?.user_id]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      releaseCameraStream(cameraStream);
    };
  }, [cameraStream]);

  useEffect(() => {
    if (!cameraOpen || !cameraStream || !videoRef.current) return;

    const video = videoRef.current;
    let cancelled = false;

    setCameraReady(false);
    video.srcObject = cameraStream;
    video.muted = true;
    video.playsInline = true;

    const markReady = () => {
      if (cancelled) return;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setCameraReady(true);
        setCameraLoading(false);
        setCameraError(null);
      }
    };

    const startVideo = async () => {
      try {
        await video.play();
        markReady();
      } catch {
        if (!cancelled) {
          setCameraLoading(false);
          setCameraError("Camera opened, but the preview could not start. Try re-opening the camera.");
        }
      }
    };

    video.addEventListener("loadedmetadata", startVideo);
    video.addEventListener("canplay", markReady);
    video.addEventListener("playing", markReady);

    startVideo();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", startVideo);
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("playing", markReady);
    };
  }, [cameraOpen, cameraStream]);

  const canSendNotice = useMemo(() => {
    return Boolean(scanResult?.fine?.fine_id) && !scanResult?.fine?.related_message_id;
  }, [scanResult]);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await ApiClient.getWorkerFines(user?.user_id || "", "worker", 50);
      setHistory(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function releaseCameraStream(streamToStop) {
    if (streamToStop) {
      streamToStop.getTracks().forEach((track) => track.stop());
    }
  }

  function stopCameraStream(streamToStop = cameraStream) {
    releaseCameraStream(streamToStop);

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore pause failures during cleanup
      }
      videoRef.current.srcObject = null;
    }

    if (streamToStop === cameraStream) {
      setCameraStream(null);
      setCameraOpen(false);
      setCameraReady(false);
      setCameraLoading(false);
    }
  }

  function resetPatrolState() {
    setDetection(null);
    setScanResult(null);
    setNoticeStatus(null);
    setError(null);
    setMessageDraft("");
  }

  function clearSelectedImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setCaptureSource(null);
  }

  function applySelectedFile(selected, source = "upload") {
    if (!selected) return;
    stopCameraStream();
    clearSelectedImage();
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setCaptureSource(source);
    setCameraError(null);
    resetPatrolState();
  }

  async function openCamera() {
    setCameraError(null);
    setError(null);
    setCameraLoading(true);
    setCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support direct camera access. Please upload a plate image instead.");
      setCameraLoading(false);
      return;
    }

    stopCameraStream();

    const mobile = isMobileDevice();
    const attempts = mobile
      ? [
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          {
            audio: false,
            video: {
              facingMode: "environment",
            },
          },
          {
            audio: false,
            video: true,
          },
        ]
      : [
          {
            audio: false,
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          {
            audio: false,
            video: true,
          },
        ];

    let stream = null;
    let lastError = null;

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      setCameraLoading(false);
      setCameraError(
        lastError?.name === "NotAllowedError"
          ? "Camera permission was blocked. Allow camera access in your browser and try again."
          : lastError?.name === "NotFoundError"
            ? "No camera was found on this device. You can upload a plate image instead."
            : lastError?.name === "NotReadableError"
              ? "The camera is already being used by another app or browser tab."
              : "Unable to open the camera. Use HTTPS or localhost, then try again."
      );
      return;
    }

    clearSelectedImage();
    resetPatrolState();
    setCaptureSource("camera");
    setCameraStream(stream);
    setCameraOpen(true);
  }

  function handleChooseFile() {
    setCameraError(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    applySelectedFile(selected, "upload");
    e.target.value = "";
  }

  async function handleCaptureFromCamera() {
    if (!videoRef.current || !canvasRef.current || !cameraReady) {
      setCameraError("Camera preview is not ready yet. Please wait a moment and try again.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setCameraError("The camera preview is still loading. Please wait a moment and capture again.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setCameraError("Failed to capture the image from the camera. Please try again.");
      return;
    }

    const capturedFile = new File([blob], `worker-patrol-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    applySelectedFile(capturedFile, "camera");
  }

  async function handlePatrolScan(e) {
    e.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setError(null);
    setNoticeStatus(null);
    setDetection(null);
    setScanResult(null);

    try {
      const plateDetection = await ApiClient.uploadPlateImage(file);
      setDetection(plateDetection);

      if (!plateDetection?.valid || !plateDetection?.plate_text) {
        throw new Error("No readable plate was detected in the image. Please retake the photo or upload a clearer image.");
      }

      const response = await ApiClient.scanVehicleAsWorker(
        user?.user_id || "",
        plateDetection.plate_text.toUpperCase(),
        "",
        note.trim()
      );

      setScanResult(response);
      setMessageDraft(buildDefaultNotice(response));
      await loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendNotice() {
    if (!scanResult?.fine?.fine_id) return;

    setNotifying(true);
    setError(null);
    setNoticeStatus(null);
    try {
      const sent = await ApiClient.sendWorkerFineNotice(
        user?.user_id || "",
        scanResult.fine.fine_id,
        messageDraft.trim()
      );
      setNoticeStatus(sent.message);
      setScanResult((prev) => {
        if (!prev?.fine) return prev;
        return {
          ...prev,
          fine: {
            ...prev.fine,
            related_message_id: sent.message_id,
          },
        };
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setNotifying(false);
    }
  }

  function handleRetake() {
    stopCameraStream();
    clearSelectedImage();
    setNote("");
    setCameraError(null);
    resetPatrolState();
  }

  const recentSessions = scanResult?.sessions || [];

  return (
    <div className="page">
      <div className="card-header" style={{ marginBottom: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.35rem" }}>Worker Patrol</h1>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Patrol the parking area with a live camera or uploaded image, detect the plate, and automatically assign a 10,000 HUF fine when no active session exists.
          </p>
        </div>
        <button className="btn btn--sm btn--outline" onClick={loadHistory}>Refresh</button>
      </div>

      <div className="card">
        <h2>Patrol capture</h2>
        <p className="text-muted">
          Use the live camera for a real patrol workflow or upload a saved image. After capture, the app reads the plate, checks the session, and shows the owner details so you can send the fine notice.
        </p>

        <form onSubmit={handlePatrolScan} className="form-grid">
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label>Capture options</label>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <button type="button" className="btn btn--primary" onClick={openCamera} disabled={cameraLoading}>
                {cameraLoading ? "Opening Camera..." : "Open Camera"}
              </button>
              <button type="button" className="btn btn--outline" onClick={handleChooseFile}>
                Upload Image
              </button>
              {cameraOpen && (
                <button type="button" className="btn btn--outline" onClick={() => stopCameraStream()}>
                  Close Camera
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <small className="text-muted">
              Live camera works best on HTTPS or localhost. Upload remains available as a fallback on every device.
            </small>
          </div>

          {cameraError && (
            <div className="alert alert--warning" style={{ gridColumn: "1 / -1" }}>
              {cameraError}
            </div>
          )}

          {cameraOpen && (
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Live camera preview</label>

              {!cameraReady && (
                <div className="alert alert--warning" style={{ marginBottom: "0.75rem" }}>
                  Starting camera preview...
                </div>
              )}

              <div style={{ display: "grid", gap: "0.75rem" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    maxWidth: "560px",
                    minHeight: "320px",
                    objectFit: "cover",
                    borderRadius: "12px",
                    border: "1px solid var(--color-border)",
                    background: "#000",
                  }}
                />

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleCaptureFromCamera}
                    disabled={!cameraReady}
                  >
                    {cameraReady ? "Capture Photo" : "Preparing Camera..."}
                  </button>

                  <span className="text-muted" style={{ alignSelf: "center" }}>
                    Use this to capture the plate directly during patrol.
                  </span>
                </div>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: "none" }} />

          {previewUrl && (
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>{captureSource === "camera" ? "Captured image" : "Selected image"}</label>
              <img
                src={previewUrl}
                alt="Captured plate"
                style={{ width: "100%", maxWidth: "420px", borderRadius: "12px", border: "1px solid var(--color-border)" }}
              />
              <div style={{ marginTop: "0.5rem" }}>
                <span className={`badge badge--${captureSource === "camera" ? "active" : "paid"}`}>
                  {captureSource === "camera" ? "Captured with camera" : "Uploaded image"}
                </span>
              </div>
            </div>
          )}

          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label>Worker note for the fine record</label>
            <textarea
              rows="4"
              className="input"
              placeholder="Optional patrol note, for example blocked driveway or parked outside the paid period"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="form-group form-group--actions">
            <button type="submit" className="btn btn--primary" disabled={submitting || !file}>
              {submitting ? "Checking plate..." : "Check Plate and Issue Fine"}
            </button>
            <button type="button" className="btn btn--outline" onClick={handleRetake}>
              Reset
            </button>
          </div>
        </form>

        {error && <div className="alert alert--error">{error}</div>}
        {noticeStatus && <div className="alert alert--success">{noticeStatus}</div>}

        {detection && (
          <div className={`alert ${detection.valid ? "alert--success" : "alert--warning"}`}>
            <strong>Detected plate:</strong> {detection.plate_text || "No valid plate"}
            <div style={{ marginTop: "0.35rem" }}>Confidence: {Math.round((detection.confidence || 0) * 100)}%</div>
          </div>
        )}

        {scanResult && (
          <div className={`alert ${scanResult.fine_issued ? "alert--success" : "alert--warning"}`}>
            <strong>
              {scanResult.status === "active_session_found"
                ? "Active session found"
                : scanResult.status === "existing_unpaid_fine"
                  ? "Existing unpaid fine"
                  : scanResult.fine_issued
                    ? "Fine assigned"
                    : "Patrol result"}
            </strong>
            <div style={{ marginTop: "0.35rem" }}>{scanResult.message}</div>
          </div>
        )}
      </div>

      {scanResult?.owner && (
        <div className="card">
          <div className="card-header">
            <h2>Owner and vehicle details</h2>
            <span className="badge badge--active">Detected</span>
          </div>

          <div className="card-grid" style={{ marginTop: "1rem" }}>
            <div className="stat-card stat-card--info">
              <div className="stat-card__label">Owner name</div>
              <div className="stat-card__value" style={{ fontSize: "1.15rem" }}>{scanResult.owner.name}</div>
            </div>
            <div className="stat-card stat-card--revenue">
              <div className="stat-card__label">Owner email</div>
              <div className="stat-card__value" style={{ fontSize: "1.05rem" }}>{scanResult.owner.email}</div>
            </div>
            <div className="stat-card stat-card--active">
              <div className="stat-card__label">Plate number</div>
              <div className="stat-card__value mono">{scanResult.vehicle?.plate_number || scanResult.plate_number}</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__label">Vehicle type</div>
              <div className="stat-card__value" style={{ fontSize: "1.15rem", textTransform: "capitalize" }}>
                {scanResult.vehicle?.vehicle_type || "Unknown"}
              </div>
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <tbody>
                <tr>
                  <td className="bold">Registration status</td>
                  <td>{scanResult.vehicle?.registration_status || "-"}</td>
                  <td className="bold">Owner user ID</td>
                  <td className="mono">{scanResult.owner.user_id}</td>
                </tr>
                <tr>
                  <td className="bold">Fine status</td>
                  <td>
                    {scanResult.fine ? (
                      <span className={`badge badge--${scanResult.fine.status === "unpaid" ? "unpaid" : "paid"}`}>
                        {scanResult.fine.status}
                      </span>
                    ) : (
                      <span className="badge badge--paid">No fine</span>
                    )}
                  </td>
                  <td className="bold">Fine amount</td>
                  <td>{scanResult.fine ? formatMoney(scanResult.fine.amount) : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {scanResult.active_session && (
            <div className="alert alert--warning" style={{ marginTop: "1rem" }}>
              Active session ID <span className="mono">{scanResult.active_session.session_id}</span> in zone <strong>{scanResult.active_session.zone_id}</strong>.
              Estimated amount: <strong>{formatMoney(scanResult.active_session.estimated_final_fee || scanResult.active_session.final_fee)}</strong>
            </div>
          )}

          {!scanResult.active_session && recentSessions.length > 0 && (
            <>
              <h2 style={{ marginTop: "1.25rem" }}>Recent parking history</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Zone</th>
                      <th>Entry</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.slice(0, 5).map((session) => (
                      <tr key={session.session_id}>
                        <td className="mono">{session.session_id.slice(0, 8)}...</td>
                        <td>{session.zone_id}</td>
                        <td>{formatDate(session.entry_timestamp)}</td>
                        <td>
                          <span className={`badge badge--${session.status === "active" ? "active" : session.status === "paid" ? "paid" : session.status === "overdue" ? "overdue" : "unpaid"}`}>
                            {session.status}
                          </span>
                        </td>
                        <td>{formatMoney(session.final_fee || session.estimated_final_fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {scanResult?.fine && (
        <div className="card">
          <h2>Send fine notice to the user</h2>
          <p className="text-muted">
            The fine is already on record. Send the owner a direct message after reviewing the patrol result.
          </p>

          <div className="form-grid">
            <div className="form-group">
              <label>Recipient email</label>
              <input type="email" className="input" value={scanResult.owner?.email || scanResult.fine.recipient_email || ""} readOnly />
            </div>
            <div className="form-group">
              <label>Fine amount</label>
              <input type="text" className="input" value={formatMoney(scanResult.fine.amount)} readOnly />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Notice message</label>
              <textarea
                rows="6"
                className="input"
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                disabled={!canSendNotice}
              />
            </div>
            <div className="form-group form-group--actions">
              <button className="btn btn--primary" type="button" onClick={handleSendNotice} disabled={!canSendNotice || notifying}>
                {notifying ? "Sending..." : scanResult.fine.related_message_id ? "Notice already sent" : "Send Fine Notice"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Recent issued fines</h2>
        {loading ? (
          <div className="page-loading">Loading fines...</div>
        ) : history.length === 0 ? (
          <p className="text-muted">No fines issued yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fine ID</th>
                  <th>Plate</th>
                  <th>User Email</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Note</th>
                  <th>Issued</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.fine_id}>
                    <td className="mono">{item.fine_id.slice(0, 8)}...</td>
                    <td className="mono bold">{item.plate_number}</td>
                    <td>{item.recipient_email}</td>
                    <td className="bold">{formatMoney(item.amount)}</td>
                    <td>{item.reason}</td>
                    <td>{item.note || "-"}</td>
                    <td>{formatDate(item.issued_at)}</td>
                    <td>
                      <span className={`badge badge--${item.status === "unpaid" ? "unpaid" : "paid"}`}>
                        {item.status}
                      </span>
                    </td>
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
