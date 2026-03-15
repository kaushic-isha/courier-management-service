import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API_BASE = "http://localhost:5000/api/outward";

function GuardAdminOrStaff({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (!["Admin", "Courier Office Staff"].includes(user.role)) return <Navigate to="/login" replace />;
  return null;
}

function prettyStatus(status) {
  if (!status) return "-";
  if (status === "in-transit") return "In Transit";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function OutwardDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdminOrStaff({ user });
  if (guard) return guard;

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingStatus, setFetchingStatus] = useState(false);

  const timeline = useMemo(() => {
    if (!Array.isArray(row?.statusTimeline)) return [];
    return row.statusTimeline;
  }, [row]);

  async function loadRow() {
    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE}/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load outward courier.");
      setRow(data);
    } catch (error) {
      alert(error.message || "Failed to load outward courier.");
      navigate("/main/admin/outward");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRow();
  }, [id]);

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  function handlePrint() {
    window.print();
  }

  async function handleFetchStatus() {
    try {
      setFetchingStatus(true);
      const response = await authFetch(`${API_BASE}/${id}/fetch-status`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch status.");
      if (data.courier) setRow(data.courier);
      alert(data.message || "Status fetched.");
    } catch (error) {
      alert(error.message || "Failed to fetch status.");
    } finally {
      setFetchingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="main-shell">
        <AdminHeader activePath="/main/admin/outward" user={user} onLogout={handleLogout} />
        <main className="main-content inward-page">
          <div>Loading outward courier details...</div>
        </main>
      </div>
    );
  }

  if (!row) return null;

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/outward" user={user} onLogout={handleLogout} />

      <main className="main-content inward-page outward-detail-page">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/main/admin" },
            { label: "Outward Couriers", to: "/main/admin/outward" },
            { label: row.docket || `OUT-${row.id}` }
          ]}
        />

        <section className="detail-summary-card">
          <div>
            <h2>{row.docket}</h2>
            <p>Dispatched on {row.dispatchDate || "-"} at {row.dispatchTime || "-"}</p>
          </div>
          <div className="detail-summary-actions">
            <span className={`status-chip ${row.status}`}>{prettyStatus(row.status)}</span>
            <button type="button" className="row-action-btn save" onClick={() => navigate(`/main/admin/outward/${row.id}/edit`)}>
              Edit
            </button>
            <button type="button" className="row-action-btn" onClick={handlePrint}>
              Print
            </button>
          </div>
        </section>

        <div className="outward-detail-grid">
          <div className="outward-detail-left">
            <section className="detail-card">
              <h3>Dispatch Details</h3>
              <div className="detail-two-col">
                <p><strong>Origin:</strong> {row.origin || "-"}</p>
                <p><strong>Department:</strong> {row.department || "-"}</p>
                <p><strong>Courier Vendor:</strong> {row.vendor || "-"}</p>
                <p><strong>Tracking Number:</strong> {row.trackingNo || "-"}</p>
              </div>
            </section>

            <section className="detail-card">
              <h3>Sender & Receiver Details</h3>
              <div className="detail-two-col">
                <p><strong>Sender Name:</strong> {row.senderName || "-"}</p>
                <p><strong>Sender Contact:</strong> {row.senderContact || "-"}</p>
                <p><strong>Receiver Name:</strong> {row.receiverName || "-"}</p>
                <p><strong>Receiver Contact:</strong> {row.receiverContact || "-"}</p>
              </div>
              <p><strong>Receiver Address:</strong> {row.receiverAddress || "-"}</p>
            </section>

            <section className="detail-card">
              <h3>Parcel & Cost Details</h3>
              <div className="detail-two-col">
                <p><strong>Number of Parcels:</strong> {row.parcels ?? "-"}</p>
                <p><strong>Weight:</strong> {row.weight || "-"}</p>
                <p><strong>Estimated Cost:</strong> {row.estCost || "-"}</p>
                <p><strong>Actual Cost:</strong> {row.actualCost || "-"}</p>
              </div>
            </section>

            <section className="detail-card">
              <h3>Important Dates</h3>
              <div className="detail-two-col">
                <p><strong>Dispatch Date:</strong> {row.dispatchDate || "-"}</p>
                <p><strong>Dispatch Time:</strong> {row.dispatchTime || "-"}</p>
                <p><strong>Delivery Date:</strong> {row.deliveryDate || "Pending"}</p>
                <p><strong>Delivery Time:</strong> {row.deliveryTime || "Pending"}</p>
              </div>
            </section>

            <section className="detail-card">
              <h3>Remarks</h3>
              <p>{row.remarks || "-"}</p>
            </section>
          </div>

          <aside className="outward-detail-right">
            <section className="detail-card">
              <h3>Live Tracking</h3>
              <p><strong>Tracking Number:</strong> {row.trackingNo || "-"}</p>
              <p><strong>Vendor:</strong> {row.vendor || "-"}</p>
              <button type="button" className="apply-bulk-btn" onClick={handleFetchStatus} disabled={fetchingStatus}>
                {fetchingStatus ? "Fetching..." : "Fetch Status"}
              </button>
              <p className="small-note">Mock tracking for now. AfterShip integration will plug in here later.</p>
            </section>

            <section className="detail-card">
              <h3>Status Timeline</h3>
              <div className="status-timeline-list">
                {timeline.length === 0 ? (
                  <p>No timeline yet.</p>
                ) : (
                  timeline.map((item, index) => (
                    <div key={`${item.status}-${item.date}-${item.time}-${index}`} className="status-timeline-item">
                      <p><strong>{item.title || prettyStatus(item.status)}</strong></p>
                      <p>{item.date || "-"} {item.time ? `at ${item.time}` : ""}</p>
                      <p>{item.note || ""}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
