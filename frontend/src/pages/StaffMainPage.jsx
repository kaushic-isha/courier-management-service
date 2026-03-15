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

function outwardMetricDate(row) {
  return row.dispatchDate || row.dateOfEntry || "";
}

function inwardMetricDate(row) {
  return row.receivedDate || row.dateOfEntry || "";
}

export default function StaffMainPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "Admin") return <Navigate to="/main/admin" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (user.role !== "Courier Office Staff") return <Navigate to="/login" replace />;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
        setError("");
        const [inwardRes, outwardRes] = await Promise.all([authFetch(INWARD_API), authFetch(OUTWARD_API)]);
        const inwardData = inwardRes.ok ? await inwardRes.json() : [];
        const outwardData = outwardRes.ok ? await outwardRes.json() : [];
        setInwardRows(Array.isArray(inwardData) ? inwardData : []);
        setOutwardRows(Array.isArray(outwardData) ? outwardData : []);
      } catch (_error) {
        setError("Failed to load dashboard data.");
        setInwardRows([]);
        setOutwardRows([]);
      } finally {
        setLoading(false);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    }

    fetchData();
    const intervalId = window.setInterval(fetchData, 30000);
    window.addEventListener("focus", fetchData);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", fetchData);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const metrics = useMemo(() => {
    const today = todayIso();
    const todayInward = inwardRows.filter((row) => inwardMetricDate(row) === today).length;
    const todayOutward = outwardRows.filter((row) => outwardMetricDate(row) === today).length;
    const pending = outwardRows.filter((row) => row.status === "sent" || row.status === "in-transit").length;
    const total = inwardRows.length + outwardRows.length;
    const received = inwardRows.filter((row) => row.status === "received").length;
    const inTransit = outwardRows.filter((row) => row.status === "in-transit").length;
    const delivered = outwardRows.filter((row) => row.status === "delivered").length;
    return { todayInward, todayOutward, pending, total, received, inTransit, delivered };
  }, [inwardRows, outwardRows]);

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/staff" user={user} onLogout={handleLogout} />
      <main className="main-content dashboard-page">
        <Breadcrumbs items={[{ label: "Home", to: "/main/staff" }, { label: "Dashboard" }]} />
        <h2>Courier Office Staff Dashboard</h2>
        <p>Overview for {user.location || "your assigned location"}</p>
        {error && <div className="report-error">{error}</div>}

        <section className="dashboard-metric-grid">
          <article className="dashboard-metric-card"><div className="dashboard-metric-icon inward">IN</div><p>Today's Inward</p><h3>{loading ? "-" : metrics.todayInward}</h3></article>
          <article className="dashboard-metric-card"><div className="dashboard-metric-icon outward">OUT</div><p>Today's Outward</p><h3>{loading ? "-" : metrics.todayOutward}</h3></article>
          <article className="dashboard-metric-card"><div className="dashboard-metric-icon pending">P</div><p>Pending</p><h3>{loading ? "-" : metrics.pending}</h3></article>
          <article className="dashboard-metric-card"><div className="dashboard-metric-icon total">T</div><p>Total</p><h3>{loading ? "-" : metrics.total}</h3></article>
        </section>

        <h3 className="dashboard-section-title">Status Overview</h3>
        <section className="dashboard-status-grid">
          <article className="dashboard-status-card"><p>Received</p><h4>{loading ? "-" : metrics.received}</h4></article>
          <article className="dashboard-status-card"><p>In Transit</p><h4>{loading ? "-" : metrics.inTransit}</h4></article>
          <article className="dashboard-status-card"><p>Delivered</p><h4>{loading ? "-" : metrics.delivered}</h4></article>
        </section>
      </main>
    </div>
  );
}
