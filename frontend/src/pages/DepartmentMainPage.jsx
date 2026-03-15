import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const INWARD_API = "http://localhost:5000/api/inward";
const OUTWARD_API = "http://localhost:5000/api/outward";

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DepartmentMainPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Admin") return <Navigate to="/main/admin" replace />;
  if (user.role === "Courier Office Staff") return <Navigate to="/main/staff" replace />;
  if (user.role !== "Department User") return <Navigate to="/login" replace />;

  const [loading, setLoading] = useState(true);
  const [inwardRows, setInwardRows] = useState([]);
  const [outwardRows, setOutwardRows] = useState([]);

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [inwardRes, outwardRes] = await Promise.all([authFetch(INWARD_API), authFetch(OUTWARD_API)]);
        const inwardData = inwardRes.ok ? await inwardRes.json() : [];
        const outwardData = outwardRes.ok ? await outwardRes.json() : [];
        setInwardRows(Array.isArray(inwardData) ? inwardData : []);
        setOutwardRows(Array.isArray(outwardData) ? outwardData : []);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const metrics = useMemo(() => {
    const today = todayIso();
    const todayInward = inwardRows.filter((row) => row.dateOfEntry === today).length;
    const todayOutward = outwardRows.filter((row) => row.dateOfEntry === today).length;
    const pending = outwardRows.filter((row) => ["requested", "sent", "in-transit"].includes(row.status)).length;
    const total = inwardRows.length + outwardRows.length;
    const received = inwardRows.filter((row) => row.status === "received").length;
    const inTransit = outwardRows.filter((row) => row.status === "in-transit").length;
    const delivered = outwardRows.filter((row) => row.status === "delivered").length;
    return { todayInward, todayOutward, pending, total, received, inTransit, delivered };
  }, [inwardRows, outwardRows]);

  const recentActivity = useMemo(() => {
    const inward = inwardRows.map((row) => ({
      id: `in-${row.id}`,
      type: "Inward",
      docket: row.docket,
      sender: row.senderName || "-",
      receiver: row.receiverName || "-",
      status: row.status || "-",
      time: row.dateOfEntry || "",
      sortKey: `${row.dateOfEntry || ""}-${String(row.id).padStart(6, "0")}`
    }));

    const outward = outwardRows.map((row) => ({
      id: `out-${row.id}`,
      type: "Outward",
      docket: row.docket,
      sender: row.senderName || "-",
      receiver: row.receiverName || "-",
      status: row.status || "-",
      time: row.dateOfEntry || "",
      sortKey: `${row.dateOfEntry || ""}-${String(row.id).padStart(6, "0")}`
    }));

    return [...inward, ...outward].sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, 8);
  }, [inwardRows, outwardRows]);

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/department" user={user} onLogout={handleLogout} />
      <main className="main-content dashboard-page">
        <Breadcrumbs items={[{ label: "Home", to: "/main/department" }, { label: "Dashboard" }]} />
        <h2>Department Dashboard</h2>
        <p>Overview for {user.department || "your department"} at {user.location || "your selected location"}</p>

        <section className="dashboard-metric-grid">
          <article className="dashboard-metric-card"><div className="dashboard-metric-icon inward">IN</div><p>Today's Inward</p><h3>{loading ? "-" : metrics.todayInward}</h3></article>
          <article className="dashboard-metric-card"><div className="dashboard-metric-icon outward">OUT</div><p>Today's Outward</p><h3>{loading ? "-" : metrics.todayOutward}</h3></article>
          <article className="dashboard-metric-card"><div className="dashboard-metric-icon pending">P</div><p>Pending</p><h3>{loading ? "-" : metrics.pending}</h3></article>
          <article className="dashboard-metric-card"><div className="dashboard-metric-icon total">T</div><p>Total</p><h3>{loading ? "-" : metrics.total}</h3></article>
        </section>

        <h3 className="dashboard-section-title">Quick Actions</h3>
        <section className="dashboard-quick-actions">
          <button type="button" className="dashboard-action-btn outward" onClick={() => navigate("/main/department/outward/request")}>
            Submit Outward Courier Request
          </button>
          <button type="button" className="dashboard-action-btn inward" onClick={() => navigate("/main/department/inward")}>
            View Inward Courier
          </button>
        </section>

        <h3 className="dashboard-section-title">Status Overview</h3>
        <section className="dashboard-status-grid">
          <article className="dashboard-status-card"><p>Received</p><h4>{loading ? "-" : metrics.received}</h4></article>
          <article className="dashboard-status-card"><p>In Transit</p><h4>{loading ? "-" : metrics.inTransit}</h4></article>
          <article className="dashboard-status-card"><p>Delivered</p><h4>{loading ? "-" : metrics.delivered}</h4></article>
        </section>

        <section className="dashboard-table-wrap dashboard-recent-wrap">
          <h3>Recent Activity</h3>
          <table className="mini-table">
            <thead>
              <tr><th>Type</th><th>Status</th><th>Docket Number</th><th>Sender</th><th>Receiver</th><th>Time</th></tr>
            </thead>
            <tbody>
              {recentActivity.map((row) => (
                <tr key={row.id}>
                  <td className="recent-type">
                    <span className={`recent-arrow ${row.type === "Inward" ? "inward" : "outward"}`}>{row.type === "Inward" ? "↙" : "↗"}</span>
                    {row.type}
                  </td>
                  <td><span className={`status-chip ${row.status.replace(/\s+/g, "-")}`}>{row.status}</span></td>
                  <td>{row.docket}</td>
                  <td>{row.sender}</td>
                  <td>{row.receiver}</td>
                  <td>{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
