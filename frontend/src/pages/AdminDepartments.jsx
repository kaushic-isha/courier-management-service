import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const DEPARTMENTS_API = "http://localhost:5000/api/settings/departments";
const LOCATIONS = ["Ashram", "Sadivayal Office"];
const SETTINGS_BUTTONS = [
  { label: "Manage Departments", path: "/main/admin/settings/departments", active: true },
  { label: "Roles", path: "/main/admin/settings" },
  { label: "Valid Statuses", path: "/main/admin/settings", state: { activeKey: "outward.validStatuses" } }
];

function GuardAdmin({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Courier Office Staff") return <Navigate to="/main/staff" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (user.role !== "Admin") return <Navigate to="/login" replace />;
  return null;
}

export default function AdminDepartmentsPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdmin({ user });
  if (guard) return guard;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departmentsByLocation, setDepartmentsByLocation] = useState({ Ashram: [], "Sadivayal Office": [] });
  const [newDepartmentDraft, setNewDepartmentDraft] = useState({ Ashram: "", "Sadivayal Office": "" });
  const [editingCell, setEditingCell] = useState({ location: "", id: null });
  const [editDraft, setEditDraft] = useState("");

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  useEffect(() => {
    async function fetchDepartments() {
      try {
        setLoading(true);
        setError("");
        const response = await authFetch(DEPARTMENTS_API);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to fetch departments.");
        setDepartmentsByLocation({
          Ashram: Array.isArray(data.Ashram) ? data.Ashram : [],
          "Sadivayal Office": Array.isArray(data["Sadivayal Office"]) ? data["Sadivayal Office"] : []
        });
      } catch (err) {
        setError(err.message || "Failed to fetch departments.");
      } finally {
        setLoading(false);
      }
    }

    fetchDepartments();
  }, []);

  async function addDepartment(location) {
    const name = String(newDepartmentDraft[location] || "").trim();
    if (!name) return;
    try {
      const response = await authFetch(DEPARTMENTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to add department.");
      setDepartmentsByLocation((prev) => ({
        ...prev,
        [location]: [...(prev[location] || []), data].sort((a, b) => a.name.localeCompare(b.name))
      }));
      setNewDepartmentDraft((prev) => ({ ...prev, [location]: "" }));
    } catch (err) {
      alert(err.message || "Failed to add department.");
    }
  }

  function startEdit(location, row) {
    setEditingCell({ location, id: row.id });
    setEditDraft(row.name || "");
  }

  function cancelEdit() {
    setEditingCell({ location: "", id: null });
    setEditDraft("");
  }

  async function saveDepartment(location, id) {
    const name = String(editDraft || "").trim();
    if (!name) {
      alert("Department name cannot be empty.");
      return;
    }
    try {
      const response = await authFetch(`${DEPARTMENTS_API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update department.");
      setDepartmentsByLocation((prev) => ({
        ...prev,
        [location]: (prev[location] || [])
          .map((row) => (row.id === id ? data : row))
          .sort((a, b) => a.name.localeCompare(b.name))
      }));
      cancelEdit();
    } catch (err) {
      alert(err.message || "Failed to update department.");
    }
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/settings/departments" user={user} onLogout={handleLogout} />
      <main className="main-content users-page">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/main/admin" },
            { label: "Admin Settings", to: "/main/admin/settings" },
            { label: "Departments" }
          ]}
        />
        <h2>Departments</h2>
        <p>Manage departments separately for Ashram and Sadivayal Office.</p>

        {error && <div className="report-error">{error}</div>}

        {loading ? (
          <section className="table-card">
            <div>Loading departments...</div>
          </section>
        ) : (
          <>
            <section className="table-card">
              <div className="users-action-row settings-nav-row">
                {SETTINGS_BUTTONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`row-action-btn ${item.active ? "save" : ""}`}
                    onClick={() => navigate(item.path, item.state ? { state: item.state } : undefined)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-department-grid">
              {LOCATIONS.map((location) => (
                <section className="dashboard-table-wrap users-table-wrap settings-table-wrap" key={location}>
                  <h3>{location} Departments</h3>

                  <div className="users-action-row settings-edit-row">
                    <input
                      type="text"
                      className="search-input"
                      placeholder={`Add new department to ${location}`}
                      value={newDepartmentDraft[location] || ""}
                      onChange={(e) => setNewDepartmentDraft((prev) => ({ ...prev, [location]: e.target.value }))}
                    />
                    <button type="button" className="row-action-btn" onClick={() => addDepartment(location)}>
                      Add
                    </button>
                  </div>

                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th style={{ width: "80px" }}>#</th>
                        <th>Department</th>
                        <th style={{ width: "180px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(departmentsByLocation[location] || []).length ? (
                        (departmentsByLocation[location] || []).map((row, index) => (
                          <tr key={`${location}-${row.id}`}>
                            <td>{index + 1}</td>
                            <td>
                              {editingCell.location === location && editingCell.id === row.id ? (
                                <input
                                  type="text"
                                  className="cell-inline-input"
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                />
                              ) : (
                                row.name
                              )}
                            </td>
                            <td>
                              {editingCell.location === location && editingCell.id === row.id ? (
                                <div className="users-action-row">
                                  <button
                                    type="button"
                                    className="row-action-btn save"
                                    onClick={() => saveDepartment(location, row.id)}
                                  >
                                    Save
                                  </button>
                                  <button type="button" className="row-action-btn discard" onClick={cancelEdit}>
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button type="button" className="row-action-btn" onClick={() => startEdit(location, row)}>
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3">No departments configured.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
