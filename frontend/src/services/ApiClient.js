const BASE_URL = import.meta.env.DEV ? "http://localhost:8000" : "/api";

function buildQuery(paramsObj = {}) {
  const params = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

const ApiClient = {
  // ── Auth ──
  async register(name, email, password, role = "user", authorizationCode = "") {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        authorization_code: authorizationCode,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Registration failed");
    }
    return res.json();
  },

  async login(email, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
    }
    return res.json();
  },

  async listUsers(role = "user") {
    const query = buildQuery({ role });
    const res = await fetch(`${BASE_URL}/auth/users${query}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getUser(userId) {
    const res = await fetch(`${BASE_URL}/auth/users/${userId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getUsersSummary(role = "user") {
    const query = buildQuery({ role });
    const res = await fetch(`${BASE_URL}/auth/users-summary${query}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async sendStaffMessage(senderUserId, recipientEmail, title, message, senderRole = "admin") {
    const res = await fetch(`${BASE_URL}/auth/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_user_id: senderUserId,
        sender_role: senderRole,
        recipient_email: recipientEmail,
        title,
        message,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to send message");
    }
    return res.json();
  },

  async getSentMessages(senderUserId, senderRole = "admin", limit = 20) {
    const query = buildQuery({ sender_user_id: senderUserId, sender_role: senderRole, limit });
    const res = await fetch(`${BASE_URL}/auth/messages/sent${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to load sent messages");
    }
    return res.json();
  },

  async scanVehicleAsWorker(workerUserId, plateNumber, recipientEmail = "", note = "") {
    const res = await fetch(`${BASE_URL}/auth/worker/scan-fine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        worker_user_id: workerUserId,
        worker_role: "worker",
        plate_number: plateNumber,
        recipient_email: recipientEmail,
        note,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Worker scan failed");
    }
    return res.json();
  },

  async getWorkerFines(userId, role = "worker", limit = 50) {
    const query = buildQuery({ user_id: userId, role, limit });
    const res = await fetch(`${BASE_URL}/auth/worker/fines${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to load worker fines");
    }
    return res.json();
  },


  async sendWorkerFineNotice(workerUserId, fineId, customMessage = "") {
    const res = await fetch(`${BASE_URL}/auth/worker/fines/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        worker_user_id: workerUserId,
        worker_role: "worker",
        fine_id: fineId,
        custom_message: customMessage,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to send fine notice");
    }
    return res.json();
  },

  async sendAdminMessage(senderUserId, recipientEmail, title, message, senderRole = "admin") {
    return this.sendStaffMessage(senderUserId, recipientEmail, title, message, senderRole);
  },

  async getAdminSentMessages(senderUserId, senderRole = "admin", limit = 20) {
    return this.getSentMessages(senderUserId, senderRole, limit);
  },

  // ── Health ──
  async healthCheck() {
    const res = await fetch(`${BASE_URL}/health`);
    return res.json();
  },

  // ── Zones ──
  async listZones() {
    const res = await fetch(`${BASE_URL}/zones/`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getZone(zoneId) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createZone(zone) {
    const res = await fetch(`${BASE_URL}/zones/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zone),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create zone");
    }
    return res.json();
  },

  async updateZone(zoneId, zone) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zone),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to update zone");
    }
    return res.json();
  },

  async deleteZone(zoneId) {
    const res = await fetch(`${BASE_URL}/zones/${zoneId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to delete zone");
    }
    return res.json();
  },

  // ── Sessions ──
  async listSessions(dateFrom = null, dateTo = null, userId = "", role = "user", plateNumber = "") {
    const query = buildQuery({ date_from: dateFrom, date_to: dateTo, user_id: userId, role, plate_number: plateNumber });
    const res = await fetch(`${BASE_URL}/sessions/${query}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getSessionQuote(sessionId, userId = "", role = "user") {
    const query = buildQuery({ user_id: userId, role });
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/quote${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to get session quote");
    }
    return res.json();
  },

  async createSession(plateNumber, zoneId, entryTimestamp = null, userId = "", userRole = "user") {
    const body = { plate_number: plateNumber, zone_id: zoneId, user_id: userId, user_role: userRole };
    if (entryTimestamp) body.entry_timestamp = entryTimestamp;
    const res = await fetch(`${BASE_URL}/sessions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create session");
    }
    return res.json();
  },

  async closeSession(sessionId, exitTimestamp = null, userId = "", userRole = "user") {
    const body = { user_id: userId, user_role: userRole };
    if (exitTimestamp) body.exit_timestamp = exitTimestamp;
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/close`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to close session");
    }
    return res.json();
  },

  // ── Vehicles ──
  async listVehicles(userId = "", role = "user") {
    const query = buildQuery({ user_id: userId, role });
    const res = await fetch(`${BASE_URL}/vehicles/${query}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getVehicle(plateNumber, userId = "", role = "user") {
    const query = buildQuery({ user_id: userId, role });
    const res = await fetch(`${BASE_URL}/vehicles/${plateNumber}${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Vehicle not found");
    }
    return res.json();
  },

  async getVehicleDetails(plateNumber, userId = "", role = "user") {
    const query = buildQuery({ user_id: userId, role });
    const res = await fetch(`${BASE_URL}/vehicles/${plateNumber}/details${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to load vehicle details");
    }
    return res.json();
  },

  async findVehicle(plateNumber, userId = "", role = "user") {
    const query = buildQuery({ user_id: userId, role });
    const res = await fetch(`${BASE_URL}/vehicles/${plateNumber}${query}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to look up vehicle");
    }
    return res.json();
  },

  async createVehicle(vehicle) {
    const res = await fetch(`${BASE_URL}/vehicles/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicle),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create vehicle");
    }
    return res.json();
  },

  async deleteVehicle(plateNumber) {
    const res = await fetch(`${BASE_URL}/vehicles/${plateNumber}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to delete vehicle");
    }
    return res.json();
  },

  // ── Reports ──
  async revenueByZone() {
    const res = await fetch(`${BASE_URL}/reports/revenue-by-zone`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async revenueSummary() {
    const res = await fetch(`${BASE_URL}/reports/revenue-summary`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ── Upload ──
  async uploadPlateImage(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/upload/plate-image`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to process image");
    }
    return res.json();
  },

  // ── Payments ──
  async paySessions(sessionIds, userId = "", cardholderName = "", cardLastFour = "", userRole = "user") {
    const res = await fetch(`${BASE_URL}/payments/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_ids: sessionIds,
        user_id: userId,
        cardholder_name: cardholderName,
        card_last_four: cardLastFour,
        user_role: userRole,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Payment failed");
    }
    return res.json();
  },

  async checkoutActiveSession(sessionId, userId = "", cardholderName = "", cardLastFour = "", userRole = "user") {
    const res = await fetch(`${BASE_URL}/payments/checkout-active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        cardholder_name: cardholderName,
        card_last_four: cardLastFour,
        user_role: userRole,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to submit payment");
    }
    return res.json();
  },

  async payAllByPlate(plateNumber, userId = "", cardholderName = "", cardLastFour = "", userRole = "user") {
    const res = await fetch(`${BASE_URL}/payments/pay-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plate_number: plateNumber,
        user_id: userId,
        cardholder_name: cardholderName,
        card_last_four: cardLastFour,
        user_role: userRole,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Payment failed");
    }
    return res.json();
  },

  async getUnpaidSessions(plateNumber, userId = "", role = "user") {
    const query = buildQuery({ user_id: userId, role });
    const res = await fetch(`${BASE_URL}/payments/unpaid/${plateNumber}${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to load unpaid sessions");
    }
    return res.json();
  },

  async checkPenalty(plateNumber, userId = "", role = "user") {
    const query = buildQuery({ user_id: userId, role });
    const res = await fetch(`${BASE_URL}/payments/check-penalty/${plateNumber}${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to check penalty");
    }
    return res.json();
  },

  async getPaymentHistory(userId) {
    const res = await fetch(`${BASE_URL}/payments/history/${userId}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to load payment history");
    }
    return res.json();
  },

  async getAdminPaymentRecords() {
    const res = await fetch(`${BASE_URL}/payments/admin-records`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to load admin payment records");
    }
    return res.json();
  },

  async getNotices(userId = "", role = "user") {
    const query = buildQuery({ user_id: userId, role });
    const res = await fetch(`${BASE_URL}/payments/notices${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to load messages");
    }
    return res.json();
  },

  async getCongestion() {
    const res = await fetch(`${BASE_URL}/payments/congestion`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to load congestion");
    }
    return res.json();
  },
};

export default ApiClient;
