import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API = "http://localhost:5000/api/outward/requests";

export default function DepartmentRequestsPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "Department User") return <Navigate to="/main" replace />;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  useEffect(() => {
    async function run() {
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
    run();
  }, []);

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/department/requests" user={user} onLogout={handleLogout} />
      <main className="main-content inward-page">
        <Breadcrumbs items={[{ label: "Home", to: "/main/department" }, { label: "Requests" }]} />
        <div className="inward-title-row">
          <div>
            <h2>Outward Requests</h2>
            <p>Track submitted request statuses for {user.department || "your department"} at {user.location || "your selected location"}</p>
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
                    <th>Status</th>
                    <th>Origin</th>
                    <th>Sender</th>
                    <th>Contact</th>
                    <th>Vendor</th>
                    <th>Parcels</th>
                    <th>Type</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.docket}</td>
                      <td><span className={`status-chip ${String(row.status || "").replace(/\s+/g, "-")}`}>{row.status}</span></td>
                      <td>{row.origin || "-"}</td>
                      <td>{row.senderName}</td>
                      <td>{row.senderContact}</td>
                      <td>{row.vendor}</td>
                      <td>{row.parcels}</td>
                      <td>{row.type}</td>
                      <td>{row.dateOfEntry || "-"}</td>
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
