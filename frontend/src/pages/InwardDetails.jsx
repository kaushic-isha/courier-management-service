import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API_BASE = "http://localhost:5000/api/inward";

function GuardAdminOrStaff({ user }) {
  const token = localStorage.getItem("authToken");
  if (!user && !token) return <Navigate to="/login" replace />;
  if (!user && token) return null;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (!["Admin", "Courier Office Staff"].includes(user.role)) return <Navigate to="/login" replace />;
  return null;
}

function prettyStatus(status) {
  if (!status) return "-";
  if (status === "handed-over") return "Handed Over";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function InwardDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdminOrStaff({ user });
  if (guard) return guard;

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRow() {
      try {
        setLoading(true);
        const response = await authFetch(`${API_BASE}/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to load inward courier.");
        setRow(data);
      } catch (error) {
        alert(error.message || "Failed to load inward courier.");
        navigate("/main/admin/inward");
      } finally {
        setLoading(false);
      }
    }

    loadRow();
  }, [id, navigate]);

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="main-shell">
        <AdminHeader activePath="/main/admin/inward" user={user} onLogout={handleLogout} />
        <main className="main-content inward-page">
          <div>Loading inward courier details...</div>
        </main>
      </div>
    );
  }

  if (!row) return null;

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/inward" user={user} onLogout={handleLogout} />

      <main className="main-content inward-page outward-detail-page inward-detail-page">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/main/admin" },
            { label: "Inward Couriers", to: "/main/admin/inward" },
            { label: row.docket || `IN-${row.id}` }
          ]}
        />

        <section className="detail-summary-card">
          <div>
            <h2>{row.docket}</h2>
            <p>Received on {row.receivedDate || "-"} at {row.receivedTime || "-"}</p>
          </div>
          <div className="detail-summary-actions">
            <span className={`status-chip ${row.status}`}>{prettyStatus(row.status)}</span>
            <button type="button" className="row-action-btn" onClick={() => navigate(`/main/admin/inward/${row.id}/edit`)}>Edit</button>
            <button type="button" className="row-action-btn" onClick={handlePrint}>Print</button>
          </div>
        </section>

        <div className="inward-detail-single">
          <section className="detail-card">
            <h3>Courier Details</h3>
            <div className="detail-two-col">
              <p><strong>Source:</strong> {row.source || "-"}</p>
              <p><strong>Delivered To:</strong> {row.deliveredTo || "-"}</p>
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
            <p><strong>Sender Address:</strong> {row.senderAddress || "-"}</p>
          </section>

          <section className="detail-card">
            <h3>Parcel Details</h3>
            <div className="detail-two-col">
              <p><strong>Number of Parcels:</strong> {row.parcels ?? "-"}</p>
              <p><strong>Weight:</strong> {row.weight || "-"}</p>
              <p><strong>Status:</strong> {prettyStatus(row.status)}</p>
              <p><strong>Date of Entry:</strong> {row.dateOfEntry || "-"}</p>
            </div>
          </section>

          <section className="detail-card">
            <h3>Important Dates</h3>
            <div className="detail-two-col">
              <p><strong>Received Date:</strong> {row.receivedDate || "-"}</p>
              <p><strong>Received Time:</strong> {row.receivedTime || "-"}</p>
              <p><strong>Collected Date:</strong> {row.collectedDate || "Pending"}</p>
              <p><strong>Collected Time:</strong> {row.collectedTime || "Pending"}</p>
            </div>
          </section>

          <section className="detail-card">
            <h3>Remarks</h3>
            <p>{row.remarks || "-"}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
