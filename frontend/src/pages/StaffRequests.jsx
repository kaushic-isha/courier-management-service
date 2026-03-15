import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API = "http://localhost:5000/api/outward/requests/pending/list";

function GuardAdminOrStaff({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (![
    "Admin",
    "Courier Office Staff"
  ].includes(user.role)) return <Navigate to="/main" replace />;
  return null;
}

export default function StaffRequestsPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdminOrStaff({ user });
  if (guard) return guard;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  async function loadRows() {
    try {
      setLoading(true);
      const response = await authFetch(API);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load requests.");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      alert(error.message || "Failed to load requests.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function rejectRequest(id) {
    try {
      const response = await authFetch(`http://localhost:5000/api/outward/requests/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to reject request.");
      await loadRows();
    } catch (error) {
      alert(error.message || "Failed to reject request.");
    }
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/requests" user={user} onLogout={handleLogout} />
      <main className="main-content inward-page">
        <Breadcrumbs items={[{ label: "Home", to: "/main/admin" }, { label: "Requests" }]} />
        <div className="inward-title-row">
          <div>
            <h2>Pending Outward Requests</h2>
            <p>Accept or reject department outward requests</p>
          </div>
        </div>

        <section className="table-card">
          {loading ? (
            <div>Loading requests...</div>
          ) : (
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Docket</th>
                    <th>Origin</th>
                    <th>Department</th>
                    <th>Sender</th>
                    <th>Contact</th>
                    <th>Vendor</th>
                    <th>Parcels</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.docket}</td>
                      <td>{row.origin || "-"}</td>
                      <td>{row.department}</td>
                      <td>{row.senderName}</td>
                      <td>{row.senderContact}</td>
                      <td>{row.vendor}</td>
                      <td>{row.parcels}</td>
                      <td>{row.type}</td>
                      <td>
                        <div className="request-action-row">
                          <button type="button" className="row-action-btn save" onClick={() => navigate(`/main/admin/outward/new?requestId=${row.id}`)}>Accept</button>
                          <button type="button" className="row-action-btn discard" onClick={() => rejectRequest(row.id)}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
