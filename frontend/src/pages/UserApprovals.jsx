import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const PENDING_API = "http://localhost:5000/api/users/pending";
const APPROVE_API = "http://localhost:5000/api/users";

export default function UserApprovalsPage() {
  const navigate = useNavigate();
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  if (!loggedInUser) return <Navigate to="/login" replace />;

  const canApprove = loggedInUser.role === "Admin" || Boolean(loggedInUser.canApproveUsers);
  if (!canApprove) return <Navigate to="/main" replace />;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionInProgress, setActionInProgress] = useState(null);

  useEffect(() => {
    fetchPending();
  }, []);

  async function fetchPending() {
    try {
      setLoading(true);
      setError("");
      const response = await authFetch(PENDING_API);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch pending users.");
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(err.message || "Failed to fetch pending users.");
    } finally {
      setLoading(false);
    }
  }

  async function updateApproval(rowId, approve) {
    try {
      setActionInProgress(rowId);
      const response = await authFetch(`${APPROVE_API}/${rowId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update approval.");
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    } catch (err) {
      alert(err.message || "Failed to update approval status.");
    } finally {
      setActionInProgress(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/approvals" user={loggedInUser} onLogout={handleLogout} />
      <main className="main-content users-page">
        <Breadcrumbs items={[{ label: "Home", to: "/main/admin" }, { label: "User Approvals" }]} />
        <h2>User Approvals</h2>
        <p>Approve or reject new registration requests in your scope.</p>

        {error && <div className="report-error">{error}</div>}

        <section className="dashboard-table-wrap users-table-wrap">
          <h3>Pending Registrations</h3>
          <table className="mini-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Location</th>
                <th>Department</th>
                <th>Requested On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7">Loading pending users...</td>
                </tr>
              ) : rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.email}</td>
                    <td>{row.role}</td>
                    <td>{row.location || "-"}</td>
                    <td>{row.department || "-"}</td>
                    <td>{row.createdAt ? String(row.createdAt).slice(0, 10) : "-"}</td>
                    <td>
                      <div className="users-action-row">
                        <button
                          type="button"
                          className="row-action-btn save"
                          disabled={actionInProgress === row.id}
                          onClick={() => updateApproval(row.id, true)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="row-action-btn discard"
                          disabled={actionInProgress === row.id}
                          onClick={() => updateApproval(row.id, false)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">No pending registrations.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
