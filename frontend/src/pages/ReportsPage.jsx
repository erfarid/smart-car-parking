import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import ApiClient from "../services/ApiClient";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#818cf8",
  "#7c3aed",
  "#4f46e5",
];

export default function ReportsPage() {
  const [revenueByZone, setRevenueByZone] = useState([]);
  const [summary, setSummary] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    setError(null);
    try {
      const [rev, sum, z] = await Promise.all([
        ApiClient.revenueByZone(),
        ApiClient.revenueSummary(),
        ApiClient.listZones(),
      ]);
      setRevenueByZone(rev);
      setSummary(sum);
      setZones(z);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="page-loading">Loading reports...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  // Map zone_id to zone_name
  const zoneMap = {};
  zones.forEach((z) => (zoneMap[z.zone_id] = z.zone_name));

  // Bar chart: Revenue by Zone
  const barData = {
    labels: revenueByZone.map(
      (r) => zoneMap[r.zone_id] || r.zone_id
    ),
    datasets: [
      {
        label: "Revenue (HUF)",
        data: revenueByZone.map((r) => r.revenue),
        backgroundColor: COLORS.slice(0, revenueByZone.length),
        borderRadius: 6,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Revenue by Zone",
        font: { size: 16, weight: "600" },
        color: "#1e293b",
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y.toLocaleString()} HUF`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (val) => `${(val / 1000).toFixed(0)}k`,
        },
        grid: { color: "#f1f5f9" },
      },
      x: {
        grid: { display: false },
        ticks: { maxRotation: 45 },
      },
    },
  };

  // Doughnut chart: Session status breakdown
  const doughnutData = {
    labels: ["Paid", "Unpaid", "Overdue"],
    datasets: [
      {
        data: [
          summary.paid_count,
          summary.unpaid_count,
          summary.overdue_count,
        ],
        backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { padding: 16, usePointStyle: true },
      },
      title: {
        display: true,
        text: "Session Status Breakdown",
        font: { size: 16, weight: "600" },
        color: "#1e293b",
      },
    },
  };

  return (
    <div className="page">
      <h1>Reports</h1>

      {/* Summary Cards */}
      <div className="card-grid">
        <div className="stat-card stat-card--revenue">
          <div className="stat-card__label">Total Revenue</div>
          <div className="stat-card__value">
            {(summary.total_revenue || 0).toLocaleString()} HUF
          </div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__label">Paid</div>
          <div className="stat-card__value">{summary.paid_count}</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__label">Unpaid</div>
          <div className="stat-card__value">{summary.unpaid_count}</div>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card__label">Overdue</div>
          <div className="stat-card__value">{summary.overdue_count}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="card chart-card">
          <div className="chart-container" style={{ height: "350px" }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
        <div className="card chart-card">
          <div className="chart-container" style={{ height: "350px" }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Revenue Table */}
      <div className="card">
        <h2>Revenue Breakdown by Zone</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Zone ID</th>
                <th>Zone Name</th>
                <th>Rate (HUF/hr)</th>
                <th>Revenue (HUF)</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {revenueByZone.map((r) => {
                const zone = zones.find((z) => z.zone_id === r.zone_id);
                const totalRev = revenueByZone.reduce(
                  (sum, x) => sum + x.revenue,
                  0
                );
                const share = totalRev > 0 ? (r.revenue / totalRev) * 100 : 0;
                return (
                  <tr key={r.zone_id}>
                    <td className="mono bold">{r.zone_id}</td>
                    <td>{zoneMap[r.zone_id] || "—"}</td>
                    <td>
                      {zone ? zone.base_hourly_rate.toLocaleString() : "—"}
                    </td>
                    <td className="bold">{r.revenue.toLocaleString()}</td>
                    <td>
                      <div className="progress-bar">
                        <div
                          className="progress-bar__fill"
                          style={{ width: `${share}%` }}
                        />
                        <span className="progress-bar__label">
                          {share.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
