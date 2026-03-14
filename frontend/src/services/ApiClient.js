const BASE_URL = import.meta.env.DEV ? "http://localhost:8000" : "/api";

// Small helper to safely parse JSON or text errors
async function parseResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { detail: text };
  }
}

const ApiClient = {
  /* ----------------------------- AUTH ----------------------------- */
  async registerUser(payload) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Registration failed");
    return data;
  },

  async loginUser(payload) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Login failed");
    return data;
  },

  /* ----------------------------- HEALTH --------------------------- */
  async healthCheck() {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Health check failed");
    return data;
  },

  /* ------------------------------ ZONES --------------------------- */
  async listZones() {
    const res = await fetch(`${BASE_URL}/zones/`);
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to load zones");
    return data;
  },

  async getZone(zoneId) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`);
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to load zone");
    return data;
  },

  async createZone(zone) {
    const res = await fetch(`${BASE_URL}/zones/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zone),
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to create zone");
    return data;
  },

  async updateZone(zoneId, zone) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zone),
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to update zone");
    return data;
  },

  async deleteZone(zoneId) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`, {
      method: "DELETE",
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to delete zone");
    return data;
  },

  /* ----------------------------- SESSIONS ------------------------- */
  async listSessions(dateFrom = null, dateTo = null) {
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    const query = params.toString() ? `?${params.toString()}` : "";

    const res = await fetch(`${BASE_URL}/sessions/${query}`);
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to load sessions");
    return data;
  },

  async createSession(plateNumber, zoneId, entryTimestamp = null) {
    const body = { plate_number: plateNumber, zone_id: zoneId };
    if (entryTimestamp) body.entry_timestamp = entryTimestamp;

    const res = await fetch(`${BASE_URL}/sessions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to create session");
    return data;
  },

  async closeSession(sessionId, exitTimestamp = null) {
    const body = {};
    if (exitTimestamp) body.exit_timestamp = exitTimestamp;

    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/close`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to close session");
    return data;
  },

  /* ----------------------------- VEHICLES ------------------------- */
  async listVehicles() {
    const res = await fetch(`${BASE_URL}/vehicles/`);
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to load vehicles");
    return data;
  },

  async getVehicle(plateNumber) {
    const res = await fetch(`${BASE_URL}/vehicles/${plateNumber}`);
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Vehicle not found");
    return data;
  },

  async createVehicle(vehicle) {
    const res = await fetch(`${BASE_URL}/vehicles/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicle),
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to create vehicle");
    return data;
  },

  async registerVehicle(plateNumber, extra = {}) {
    const payload = {
      plate_number: (plateNumber || "").trim().toUpperCase(),
      owner_name: extra.owner_name ?? "Unknown",
      vehicle_type: extra.vehicle_type ?? "Car",
      registration_status: extra.registration_status ?? "active",
    };

    if (!payload.plate_number) throw new Error("Plate number is required");
    return this.createVehicle(payload);
  },

  async deleteVehicle(plateNumber) {
    const res = await fetch(`${BASE_URL}/vehicles/${plateNumber}`, {
      method: "DELETE",
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to delete vehicle");
    return data;
  },

  /* ----------------------------- REPORTS -------------------------- */
  async revenueByZone() {
    const res = await fetch(`${BASE_URL}/reports/revenue-by-zone`);
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to load revenue by zone");
    return data;
  },

  async revenueSummary() {
    const res = await fetch(`${BASE_URL}/reports/revenue-summary`);
    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to load summary");
    return data;
  },

  /* -------------------------- PLATE DETECTION --------------------- */
  async uploadPlateImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE_URL}/upload/plate-image`, {
      method: "POST",
      body: formData,
    });

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data.detail || "Failed to process image");
    return data;
  },
};

export default ApiClient;

/* ✅ Optional: keep named exports so old imports still work */
export const registerUser = (payload) => ApiClient.registerUser(payload);
export const loginUser = (payload) => ApiClient.loginUser(payload);
export const registerVehicle = (plate, extra) => ApiClient.registerVehicle(plate, extra);
export const uploadPlateImage = (file) => ApiClient.uploadPlateImage(file);
export const listZones = () => ApiClient.listZones();
export const listSessions = (a, b) => ApiClient.listSessions(a, b);
export const revenueSummary = () => ApiClient.revenueSummary();
export const getVehicle = (plate) => ApiClient.getVehicle(plate);
export const createSession = (plate, zone) => ApiClient.createSession(plate, zone);