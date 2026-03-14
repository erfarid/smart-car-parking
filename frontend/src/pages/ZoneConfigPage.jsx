import { useState, useEffect } from "react";
import ApiClient from "../services/ApiClient";

const emptyZone = {
  zone_id: "",
  zone_name: "",
  base_hourly_rate: 1000,
  peak_start: "08:00",
  peak_end: "18:00",
  peak_multiplier: 1.5,
  max_duration_minutes: 240,
  overstay_multiplier: 2.0,
};

export default function ZoneConfigPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  // Form state
  const [editing, setEditing] = useState(null); // null = creating new
  const [form, setForm] = useState({ ...emptyZone });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadZones();
  }, []);

  async function loadZones() {
    setLoading(true);
    try {
      const z = await ApiClient.listZones();
      setZones(z);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(zone) {
    setEditing(zone.zone_id);
    setForm({ ...zone });
    setShowForm(true);
    setMsg(null);
  }

  function handleNewZone() {
    setEditing(null);
    setForm({ ...emptyZone });
    setShowForm(true);
    setMsg(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    try {
      if (editing) {
        await ApiClient.updateZone(editing, form);
        setMsg({ type: "success", text: `Zone ${editing} updated successfully.` });
      } else {
        await ApiClient.createZone(form);
        setMsg({ type: "success", text: `Zone ${form.zone_id} created successfully.` });
      }
      setShowForm(false);
      setEditing(null);
      setForm({ ...emptyZone });
      loadZones();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  async function handleDelete(zoneId) {
    if (!confirm(`Delete zone ${zoneId}?`)) return;
    setMsg(null);
    try {
      await ApiClient.deleteZone(zoneId);
      setMsg({ type: "success", text: `Zone ${zoneId} deleted.` });
      loadZones();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <div className="page-loading">Loading zones...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  return (
    <div className="page">
      <h1>Zone Configuration</h1>

      {msg && <div className={`alert alert--${msg.type}`}>{msg.text}</div>}

      {/* Zone Form */}
      <div className="card">
        <div className="card-header">
          <h2>{editing ? `Edit Zone: ${editing}` : "Zones"}</h2>
          {!showForm && (
            <button className="btn btn--primary" onClick={handleNewZone}>
              Add Zone
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="form-grid form-grid--2col">
            <div className="form-group">
              <label>Zone ID</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Z_008"
                value={form.zone_id}
                onChange={(e) => updateForm("zone_id", e.target.value)}
                disabled={!!editing}
                required
              />
            </div>
            <div className="form-group">
              <label>Zone Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. District_VIII"
                value={form.zone_name}
                onChange={(e) => updateForm("zone_name", e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Base Hourly Rate (HUF)</label>
              <input
                type="number"
                className="input"
                min="1"
                value={form.base_hourly_rate}
                onChange={(e) =>
                  updateForm("base_hourly_rate", parseInt(e.target.value) || 0)
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Peak Start</label>
              <input
                type="time"
                className="input"
                value={form.peak_start}
                onChange={(e) => updateForm("peak_start", e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Peak End</label>
              <input
                type="time"
                className="input"
                value={form.peak_end}
                onChange={(e) => updateForm("peak_end", e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Peak Multiplier</label>
              <input
                type="number"
                className="input"
                min="1"
                step="0.1"
                value={form.peak_multiplier}
                onChange={(e) =>
                  updateForm("peak_multiplier", parseFloat(e.target.value) || 1)
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Max Duration (min)</label>
              <input
                type="number"
                className="input"
                min="1"
                value={form.max_duration_minutes}
                onChange={(e) =>
                  updateForm(
                    "max_duration_minutes",
                    parseInt(e.target.value) || 0
                  )
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Overstay Multiplier</label>
              <input
                type="number"
                className="input"
                min="1"
                step="0.1"
                value={form.overstay_multiplier}
                onChange={(e) =>
                  updateForm(
                    "overstay_multiplier",
                    parseFloat(e.target.value) || 1
                  )
                }
                required
              />
            </div>
            <div className="form-group form-group--actions">
              <button type="submit" className="btn btn--primary">
                {editing ? "Update Zone" : "Create Zone"}
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Zones Table */}
      <div className="card">
        <h2>All Zones ({zones.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Zone ID</th>
                <th>Name</th>
                <th>Rate (HUF/hr)</th>
                <th>Peak Hours</th>
                <th>Peak Multiplier</th>
                <th>Max Duration</th>
                <th>Overstay Mult.</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.zone_id}>
                  <td className="mono bold">{z.zone_id}</td>
                  <td>{z.zone_name}</td>
                  <td>{z.base_hourly_rate.toLocaleString()}</td>
                  <td>
                    {z.peak_start} — {z.peak_end}
                  </td>
                  <td>{z.peak_multiplier}x</td>
                  <td>{z.max_duration_minutes} min</td>
                  <td>{z.overstay_multiplier}x</td>
                  <td>
                    <div className="btn-group">
                      <button
                        className="btn btn--sm btn--outline"
                        onClick={() => handleEdit(z)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn--sm btn--danger"
                        onClick={() => handleDelete(z.zone_id)}
                      >
                        Delete
                      </button>
                    </div>
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
