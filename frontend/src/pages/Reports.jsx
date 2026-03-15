import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const INWARD_API = "http://localhost:5000/api/inward";
const OUTWARD_API = "http://localhost:5000/api/outward";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(dateValue) {
  if (!dateValue) return null;
  const d = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function toMoney(value) {
  return Number.parseFloat(value || "0") || 0;
}

function toDays(fromDate, toDate) {
  const start = parseDate(fromDate);
  const end = parseDate(toDate);
  if (!start || !end) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

function changePct(current, previous) {
  if (previous === 0) {
    if (current === 0) return "0.0%";
    return current > 0 ? "+100.0%" : "-100.0%";
  }
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function GuardReportsAccess({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (!["Admin", "Courier Office Staff", "Department User"].includes(user.role)) return <Navigate to="/login" replace />;
  return null;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatCurrency(amount) {
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardReportsAccess({ user });
  if (guard) return guard;
  const isDepartmentUser = user?.role === "Department User";
  const homePath = isDepartmentUser ? "/main/department" : "/main/admin";
  const activePath = isDepartmentUser ? "/main/department/reports" : "/main/admin/reports";
  const lockedDepartment = isDepartmentUser ? user?.department || "All Departments" : "";

  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inwardRows, setInwardRows] = useState([]);
  const [outwardRows, setOutwardRows] = useState([]);
  const [fromDate, setFromDate] = useState(formatDateInput(startOfYear));
  const [toDate, setToDate] = useState(formatDateInput(today));
  const [vendorFilter, setVendorFilter] = useState("All Vendors");
  const [departmentFilter, setDepartmentFilter] = useState(lockedDepartment || "All Departments");

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  async function fetchRows() {
    try {
      setLoading(true);
      setError("");
      const [inwardRes, outwardRes] = await Promise.all([authFetch(INWARD_API), authFetch(OUTWARD_API)]);
      const inwardData = inwardRes.ok ? await inwardRes.json() : [];
      const outwardData = outwardRes.ok ? await outwardRes.json() : [];
      setInwardRows(Array.isArray(inwardData) ? inwardData : []);
      setOutwardRows(Array.isArray(outwardData) ? outwardData : []);
    } catch (_err) {
      setError("Failed to load report data.");
      setInwardRows([]);
      setOutwardRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  useEffect(() => {
    if (!lockedDepartment) return;
    setDepartmentFilter(lockedDepartment);
  }, [lockedDepartment]);

  const vendors = useMemo(() => {
    const set = new Set();
    [...inwardRows, ...outwardRows].forEach((r) => r.vendor && set.add(r.vendor));
    return ["All Vendors", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [inwardRows, outwardRows]);

  const departments = useMemo(() => {
    if (lockedDepartment) return [lockedDepartment];
    const set = new Set();
    [...inwardRows, ...outwardRows].forEach((r) => r.department && set.add(r.department));
    return ["All Departments", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [inwardRows, outwardRows, lockedDepartment]);

  const filtered = useMemo(() => {
    const from = parseDate(fromDate);
    const to = parseDate(toDate);

    function keepRow(row) {
      if (vendorFilter !== "All Vendors" && row.vendor !== vendorFilter) return false;
      if (lockedDepartment && row.department !== lockedDepartment) return false;
      if (!lockedDepartment && departmentFilter !== "All Departments" && row.department !== departmentFilter) return false;
      if (!from && !to) return true;
      const rowDate = parseDate(row.dateOfEntry);
      if (!rowDate) return false;
      if (from && rowDate < from) return false;
      if (to && rowDate > to) return false;
      return true;
    }

    return {
      inward: inwardRows.filter(keepRow),
      outward: outwardRows.filter(keepRow)
    };
  }, [inwardRows, outwardRows, fromDate, toDate, vendorFilter, departmentFilter, lockedDepartment]);

  const previousFiltered = useMemo(() => {
    const from = parseDate(fromDate);
    const to = parseDate(toDate);

    function keepRow(row, rangeFrom, rangeTo) {
      if (vendorFilter !== "All Vendors" && row.vendor !== vendorFilter) return false;
      if (lockedDepartment && row.department !== lockedDepartment) return false;
      if (!lockedDepartment && departmentFilter !== "All Departments" && row.department !== departmentFilter) return false;
      if (!rangeFrom && !rangeTo) return true;
      const rowDate = parseDate(row.dateOfEntry);
      if (!rowDate) return false;
      if (rangeFrom && rowDate < rangeFrom) return false;
      if (rangeTo && rowDate > rangeTo) return false;
      return true;
    }

    if (!from || !to || to < from) {
      return { inward: [], outward: [] };
    }

    const rangeDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const previousTo = new Date(from);
    previousTo.setDate(previousTo.getDate() - 1);
    const previousFrom = new Date(previousTo);
    previousFrom.setDate(previousFrom.getDate() - (rangeDays - 1));

    return {
      inward: inwardRows.filter((row) => keepRow(row, previousFrom, previousTo)),
      outward: outwardRows.filter((row) => keepRow(row, previousFrom, previousTo))
    };
  }, [inwardRows, outwardRows, fromDate, toDate, vendorFilter, departmentFilter, lockedDepartment]);

  const currentYear = parseDate(toDate)?.getFullYear() || today.getFullYear();
  const trendYear = today.getFullYear();

  const vendorVolume = useMemo(() => {
    const map = new Map();
    [...filtered.inward, ...filtered.outward].forEach((row) => {
      const key = row.vendor || "Other";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const monthlyVolume = useMemo(() => {
    const inward = Array.from({ length: 12 }, () => 0);
    const outward = Array.from({ length: 12 }, () => 0);

    filtered.inward.forEach((row) => {
      const d = parseDate(row.dateOfEntry);
      if (!d || d.getFullYear() !== currentYear) return;
      inward[d.getMonth()] += 1;
    });
    filtered.outward.forEach((row) => {
      const d = parseDate(row.dateOfEntry);
      if (!d || d.getFullYear() !== currentYear) return;
      outward[d.getMonth()] += 1;
    });

    return MONTHS.map((month, index) => ({ month, inward: inward[index], outward: outward[index] }));
  }, [filtered, currentYear]);

  const costTrend = useMemo(() => {
    const monthlyCost = Array.from({ length: 12 }, () => 0);
    outwardRows.forEach((row) => {
      const d = parseDate(row.dateOfEntry);
      if (!d || d.getFullYear() !== trendYear) return;
      monthlyCost[d.getMonth()] += toMoney(row.actualCost) || toMoney(row.estCost);
    });
    return MONTHS.map((month, index) => ({ month, value: monthlyCost[index] }));
  }, [outwardRows, trendYear]);

  const departmentStats = useMemo(() => {
    const map = new Map();
    [...filtered.inward, ...filtered.outward].forEach((row) => {
      const key = row.department || "Unknown";
      if (!map.has(key)) map.set(key, { department: key, total: 0, cost: 0 });
      const item = map.get(key);
      item.total += 1;
    });
    filtered.outward.forEach((row) => {
      const key = row.department || "Unknown";
      const item = map.get(key);
      item.cost += toMoney(row.actualCost) || toMoney(row.estCost);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const pendingAll = useMemo(() => {
    const now = formatDateInput(today);
    const outward = filtered.outward
      .filter((r) => r.status === "sent" || r.status === "in-transit")
      .map((r) => {
        const anchor = r.dispatchDate || r.dateOfEntry;
        return {
          docket: r.docket,
          type: "Outward",
          vendor: r.vendor || "-",
          days: toDays(anchor, now) ?? 0
        };
      });
    return outward.sort((a, b) => b.days - a.days);
  }, [filtered, today]);

  const pendingDeliveries = useMemo(() => pendingAll.slice(0, 10), [pendingAll]);

  const summary = useMemo(() => {
    const totalCouriers = filtered.inward.length + filtered.outward.length;
    const totalCost = filtered.outward.reduce(
      (acc, row) => acc + (toMoney(row.actualCost) || toMoney(row.estCost)),
      0
    );
    const delivered = filtered.outward
      .map((row) => toDays(row.dispatchDate, row.deliveryDate))
      .filter((v) => typeof v === "number");
    const avgDelivery = delivered.length
      ? delivered.reduce((acc, v) => acc + v, 0) / delivered.length
      : 0;
    const pendingCount = pendingAll.length;
    const previousTotalCouriers = previousFiltered.inward.length + previousFiltered.outward.length;
    const previousTotalCost = previousFiltered.outward.reduce(
      (acc, row) => acc + (toMoney(row.actualCost) || toMoney(row.estCost)),
      0
    );
    const previousDelivered = previousFiltered.outward
      .map((row) => toDays(row.dispatchDate, row.deliveryDate))
      .filter((v) => typeof v === "number");
    const previousAvgDelivery = previousDelivered.length
      ? previousDelivered.reduce((acc, v) => acc + v, 0) / previousDelivered.length
      : 0;
    const previousPendingCount = previousFiltered.outward.filter(
      (row) => row.status === "sent" || row.status === "in-transit"
    ).length;

    return {
      totalCouriers,
      totalCost,
      avgDelivery,
      pendingCount,
      totalChange: changePct(totalCouriers, previousTotalCouriers),
      costChange: changePct(totalCost, previousTotalCost),
      avgChange: changePct(avgDelivery, previousAvgDelivery),
      pendingChange: changePct(pendingCount, previousPendingCount)
    };
  }, [filtered, pendingAll, previousFiltered]);

  function exportCsv() {
    const header = ["Type", "Docket", "Department", "Vendor", "Status", "Date", "Cost"];
    const rows = [
      ...filtered.inward.map((r) => [
        "Inward",
        r.docket || "",
        r.department || "",
        r.vendor || "",
        r.status || "",
        r.dateOfEntry || "",
        ""
      ]),
      ...filtered.outward.map((r) => [
        "Outward",
        r.docket || "",
        r.department || "",
        r.vendor || "",
        r.status || "",
        r.dateOfEntry || "",
        String(formatCurrency(toMoney(r.actualCost) || toMoney(r.estCost)))
      ])
    ];
    const csv = [header, ...rows].map((line) => line.map((c) => `"${String(c).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    downloadTextFile(`courier-report-${fromDate}-to-${toDate}.csv`, csv, "text/csv;charset=utf-8;");
  }

  function exportExcel() {
    const header = ["Type", "Docket", "Department", "Vendor", "Status", "Date", "Cost"];
    const rows = [
      ...filtered.inward.map((r) => ["Inward", r.docket, r.department, r.vendor, r.status, r.dateOfEntry, ""]),
      ...filtered.outward.map((r) => [
        "Outward",
        r.docket,
        r.department,
        r.vendor,
        r.status,
        r.dateOfEntry,
        String(formatCurrency(toMoney(r.actualCost) || toMoney(r.estCost)))
      ])
    ];
    const tsv = [header, ...rows].map((line) => line.join("\t")).join("\n");
    downloadTextFile(`courier-report-${fromDate}-to-${toDate}.xls`, tsv, "application/vnd.ms-excel");
  }

  function exportPdf() {
    window.print();
  }

  const vendorMax = Math.max(1, ...vendorVolume.map((v) => v.value));
  const groupedMax = Math.max(1, ...monthlyVolume.map((m) => Math.max(m.inward, m.outward)));
  const costMax = Math.max(1, ...costTrend.map((m) => m.value));
  const vendorAxisMax = Math.max(5, Math.ceil(vendorMax / 5) * 5);
  const groupedAxisMax = Math.max(5, Math.ceil(groupedMax / 5) * 5);
  const costAxisMax = Math.max(1000, Math.ceil(costMax / 1000) * 1000);
  const countTicks = [0, 1, 2, 3, 4, 5].map((i) => (vendorAxisMax / 5) * i);
  const groupedTicks = [0, 1, 2, 3, 4, 5].map((i) => (groupedAxisMax / 5) * i);
  const costLineData = {
    labels: costTrend.map((row) => row.month),
    datasets: [
      {
        label: "Cost (INR)",
        data: costTrend.map((row) => row.value),
        borderColor: "#2fa66a",
        backgroundColor: "#2fa66a",
        borderWidth: 2.4,
        pointRadius: 3.5,
        pointHoverRadius: 5,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#2fa66a",
        tension: 0.35
      }
    ]
  };

  const costLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          color: "#d9e0ea",
          borderDash: [4, 4]
        },
        ticks: { color: "#5f6f87" }
      },
      y: {
        beginAtZero: true,
        suggestedMax: costAxisMax,
        grid: {
          color: "#d9e0ea",
          borderDash: [4, 4]
        },
        ticks: {
          color: "#5f6f87",
          callback: (value) => formatCurrency(Number(value))
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: "bottom"
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y || 0))}`
        }
      }
    }
  };

  return (
    <div className="main-shell">
      <AdminHeader activePath={activePath} user={user} onLogout={handleLogout} />

      <main className="main-content reports-page">
        <Breadcrumbs items={[{ label: "Home", to: homePath }, { label: "Reports & Analytics" }]} />
        <div className="reports-title-row">
          <div>
            <h2>Reports & Analytics</h2>
            <p>Comprehensive insights into courier operations and performance</p>
          </div>
          <div className="report-export-row">
            <button type="button" className="report-btn report-pdf" onClick={exportPdf}>
              PDF
            </button>
            <button type="button" className="report-btn report-excel" onClick={exportExcel}>
              Excel
            </button>
            <button type="button" className="report-btn report-csv" onClick={exportCsv}>
              CSV
            </button>
          </div>
        </div>

        <section className="report-filter-card">
          <h3>Filters</h3>
          <div className="report-filter-grid">
            <div>
              <label htmlFor="reportsFrom">Date From</label>
              <input
                id="reportsFrom"
                className="inward-input"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="reportsTo">Date To</label>
              <input
                id="reportsTo"
                className="inward-input"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="reportsVendor">Vendor</label>
              <select
                id="reportsVendor"
                className="inward-input"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reportsDepartment">Department</label>
              <select
                id="reportsDepartment"
                className="inward-input"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                disabled={Boolean(lockedDepartment)}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {error && <div className="report-error">{error}</div>}

        <section className="report-summary-grid">
          <article className="report-summary-card">
            <p>Total Couriers</p>
            <h4>{loading ? "-" : summary.totalCouriers.toLocaleString("en-IN")}</h4>
            <span className={summary.totalChange.startsWith("+") ? "report-up" : "report-down"}>
              {summary.totalChange}
            </span>
          </article>
          <article className="report-summary-card">
            <p>Total Cost</p>
            <h4>{loading ? "-" : formatCurrency(summary.totalCost)}</h4>
            <span className={summary.costChange.startsWith("+") ? "report-up" : "report-down"}>
              {summary.costChange}
            </span>
          </article>
          <article className="report-summary-card">
            <p>Avg. Delivery Time</p>
            <h4>{loading ? "-" : `${summary.avgDelivery.toFixed(1)} days`}</h4>
            <span className={summary.avgChange.startsWith("+") ? "report-up" : "report-down"}>
              {summary.avgChange}
            </span>
          </article>
          <article className="report-summary-card">
            <p>Pending Deliveries</p>
            <h4>{loading ? "-" : summary.pendingCount}</h4>
            <span className={summary.pendingChange.startsWith("+") ? "report-up" : "report-down"}>
              {summary.pendingChange}
            </span>
          </article>
        </section>

        <section className="reports-chart-grid">
          <article className="report-panel">
            <h3>Courier Volume by Vendor</h3>
            <div className="report-svg-wrap">
              <svg viewBox="0 0 720 320" className="report-svg-chart" role="img" aria-label="Courier Volume by Vendor">
                {countTicks.map((tick) => {
                  const y = 280 - (tick / vendorAxisMax) * 220;
                  return (
                    <g key={`vendor-tick-${tick}`}>
                      <line x1="55" y1={y} x2="700" y2={y} className="chart-grid-line" />
                      <text x="48" y={y + 4} textAnchor="end" className="chart-axis-text">
                        {Math.round(tick)}
                      </text>
                    </g>
                  );
                })}
                <line x1="55" y1="280" x2="700" y2="280" className="chart-axis-line" />
                <line x1="55" y1="40" x2="55" y2="280" className="chart-axis-line" />

                {vendorVolume.map((row, idx) => {
                  const chartW = 645;
                  const band = chartW / Math.max(1, vendorVolume.length);
                  const barW = Math.max(16, band * 0.62);
                  const x = 55 + idx * band + (band - barW) / 2;
                  const h = (row.value / vendorAxisMax) * 220;
                  const y = 280 - h;
                  return (
                    <g key={row.label}>
                      <rect x={x} y={y} width={barW} height={h} className="chart-bar-vendor">
                        <title>{`${row.label}: ${row.value}`}</title>
                      </rect>
                      <text x={x + barW / 2} y="300" textAnchor="middle" className="chart-axis-text chart-x-label">
                        {row.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </article>
          <article className="report-panel">
            <h3>Monthly Inward vs Outward ({currentYear})</h3>
            <div className="report-svg-wrap">
              <svg
                viewBox="0 0 720 320"
                className="report-svg-chart"
                role="img"
                aria-label="Monthly Inward vs Outward"
              >
                {groupedTicks.map((tick) => {
                  const y = 280 - (tick / groupedAxisMax) * 220;
                  return (
                    <g key={`grouped-tick-${tick}`}>
                      <line x1="55" y1={y} x2="700" y2={y} className="chart-grid-line" />
                      <text x="48" y={y + 4} textAnchor="end" className="chart-axis-text">
                        {Math.round(tick)}
                      </text>
                    </g>
                  );
                })}
                <line x1="55" y1="280" x2="700" y2="280" className="chart-axis-line" />
                <line x1="55" y1="40" x2="55" y2="280" className="chart-axis-line" />

                {monthlyVolume.map((row, idx) => {
                  const chartW = 645;
                  const band = chartW / 12;
                  const barW = Math.max(8, band * 0.32);
                  const groupX = 55 + idx * band + (band - barW * 2 - 4) / 2;

                  const inH = (row.inward / groupedAxisMax) * 220;
                  const outH = (row.outward / groupedAxisMax) * 220;
                  const inY = 280 - inH;
                  const outY = 280 - outH;

                  return (
                    <g key={row.month}>
                      <rect x={groupX} y={inY} width={barW} height={inH} className="chart-bar-inward">
                        <title>{`${row.month} Inward: ${row.inward}`}</title>
                      </rect>
                      <rect x={groupX + barW + 4} y={outY} width={barW} height={outH} className="chart-bar-outward">
                        <title>{`${row.month} Outward: ${row.outward}`}</title>
                      </rect>
                      <text x={groupX + barW} y="300" textAnchor="middle" className="chart-axis-text chart-x-label">
                        {row.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="grouped-legend">
              <span className="inward">Inward</span>
              <span className="outward">Outward</span>
            </div>
          </article>
        </section>

        <section className="report-panel">
          <h3>Cost Trend ({trendYear})</h3>
          <div className="cost-line-chart-wrap">
            <Line data={costLineData} options={costLineOptions} />
          </div>
        </section>

        <section className="reports-table-grid">
          <article className="report-panel">
            <h3>Department-wise Statistics</h3>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total (Inward + Outward)</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {departmentStats.map((row) => (
                  <tr key={row.department}>
                    <td>{row.department}</td>
                    <td>{row.total}</td>
                    <td>{formatCurrency(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="report-panel">
            <h3>Pending Deliveries</h3>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Docket</th>
                  <th>Type</th>
                  <th>Vendor</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {pendingDeliveries.map((row) => (
                  <tr key={`${row.type}-${row.docket}`}>
                    <td>{row.docket}</td>
                    <td>
                      <span className={`pending-chip ${row.type === "Inward" ? "inward" : "outward"}`}>
                        {row.type}
                      </span>
                    </td>
                    <td>{row.vendor}</td>
                    <td className={row.days >= 4 ? "danger-days" : ""}>{row.days} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>
      </main>
    </div>
  );
}
