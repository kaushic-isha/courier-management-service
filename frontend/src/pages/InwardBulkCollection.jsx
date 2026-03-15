import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API_BASE = "http://localhost:5000/api/inward";
const SELECTED_STORAGE_KEY = "inwardSelectedIds";

function GuardAdminOrStaff({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (!["Admin", "Courier Office Staff"].includes(user.role)) return <Navigate to="/login" replace />;
  return null;
}

export default function InwardBulkCollection() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdminOrStaff({ user });
  if (guard) return guard;

  const [form, setForm] = useState({
    collectedDate: "",
    collectedTime: "",
    collectedBy: "",
    remarks: ""
  });

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  async function handleUpdate() {
    try {
      const ids = JSON.parse(sessionStorage.getItem(SELECTED_STORAGE_KEY) || "[]");
      if (!ids.length) {
        alert("No rows selected.");
        navigate("/main/admin/inward");
        return;
      }

      const response = await authFetch(`${API_BASE}/bulk/collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...form })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Bulk collection update failed.");

      navigate("/main/admin/inward");
    } catch (error) {
      alert(error.message || "Bulk collection update failed.");
    }
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/inward" user={user} onLogout={handleLogout} />
      <main className="main-content">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/main/admin" },
            { label: "Inward Couriers", to: "/main/admin/inward" },
            { label: "Bulk Collection" }
          ]}
        />
        <h2>Bulk Update - Collection</h2>

        <section className="bulk-page-card">
          <div className="bulk-form-grid">
            <input
              className="inward-input"
              type="date"
              value={form.collectedDate}
              onChange={(e) => setForm((prev) => ({ ...prev, collectedDate: e.target.value }))}
            />
            <input
              className="inward-input"
              type="time"
              value={form.collectedTime}
              onChange={(e) => setForm((prev) => ({ ...prev, collectedTime: e.target.value }))}
            />
            <input
              className="inward-input"
              type="text"
              placeholder="Collected by"
              value={form.collectedBy}
              onChange={(e) => setForm((prev) => ({ ...prev, collectedBy: e.target.value }))}
            />
            <input
              className="inward-input"
              type="text"
              placeholder="Remarks (overrides existing)"
              value={form.remarks}
              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
            />
          </div>

          <div className="bulk-page-actions">
            <button type="button" className="apply-bulk-btn" onClick={handleUpdate}>
              Update
            </button>
            <button type="button" className="row-action-btn discard" onClick={() => navigate("/main/admin/inward")}>
              Cancel
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
