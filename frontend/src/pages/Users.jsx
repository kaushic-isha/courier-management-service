import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const USERS_API = "http://localhost:5000/api/users";
const AUTH_OPTIONS_API = "http://localhost:5000/api/auth/options";
const LOCATIONS = ["Sadivayal Office", "Ashram"];

function GuardAdmin({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Courier Office Staff") return <Navigate to="/main/staff" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (user.role !== "Admin") return <Navigate to="/login" replace />;
  return null;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdmin({ user: loggedInUser });
  if (guard) return guard;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [editingId, setEditingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [departmentsByLocation, setDepartmentsByLocation] = useState({});

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        setError("");
        const response = await authFetch(USERS_API);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to fetch users.");
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        setRows([]);
        setError(err.message || "Failed to fetch users.");
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();

    async function fetchOptions() {
      try {
        const response = await fetch(AUTH_OPTIONS_API);
        const data = await response.json();
        if (response.ok) setDepartmentsByLocation(data.departmentsByLocation || {});
      } catch (_error) {
        setDepartmentsByLocation({});
      }
    }
    fetchOptions();
  }, []);

  const baseRows = useMemo(
    () => rows.filter((row) => row.id !== loggedInUser?.id && row.email !== loggedInUser?.email),
    [rows, loggedInUser]
  );

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseRows
      .filter((row) => (roleFilter === "All Roles" ? true : row.role === roleFilter))
      .filter((row) => {
        if (!q) return true;
        return [row.email, row.role, row.location || "", row.department || ""].join(" ").toLowerCase().includes(q);
      });
  }, [baseRows, roleFilter, search]);

  function updateDraft(rowId, key, value) {
    setDrafts((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [key]: value } }));
  }

  function startEdit(row) {
    setEditingId(row.id);
    setDrafts((prev) => ({
      ...prev,
      [row.id]: {
        role: row.role || "Department User",
        department: row.department || "",
        location: row.location || "",
        isActive: Boolean(row.isActive)
      }
    }));
  }

  function cancelEdit(rowId) {
    setEditingId(null);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }

  async function saveEdit(rowId) {
    try {
      const draft = drafts[rowId];
      if (!draft) return;
      const response = await authFetch(`${USERS_API}/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update user.");
      setRows((prev) => prev.map((row) => (row.id === rowId ? data : row)));
      cancelEdit(rowId);
    } catch (err) {
      alert(err.message || "Failed to update user.");
    }
  }

  async function toggleStatus(row) {
    try {
      const response = await authFetch(`${USERS_API}/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update status.");
      setRows((prev) => prev.map((r) => (r.id === row.id ? data : r)));
    } catch (err) {
      alert(err.message || "Failed to update status.");
    }
  }

  async function deleteUser(row) {
    const yes = window.confirm(`Delete user ${row.email}?`);
    if (!yes) return;
    try {
      const response = await authFetch(`${USERS_API}/${row.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to delete user.");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      cancelEdit(row.id);
    } catch (err) {
      alert(err.message || "Failed to delete user.");
    }
  }

  const roleStats = useMemo(() => {
    const counts = {
      Admin: 0,
      "Courier Office Staff": 0,
      "Department User": 0
    };
    baseRows.forEach((row) => {
      if (counts[row.role] !== undefined) counts[row.role] += 1;
    });
    return counts;
  }, [baseRows]);

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/users" user={loggedInUser} onLogout={handleLogout} />
      <main className="main-content users-page">
        <Breadcrumbs items={[{ label: "Home", to: "/main/admin" }, { label: "Users" }]} />
        <h2>Users</h2>
        <p>Manage and review registered users from the users table.</p>

        {error && <div className="report-error">{error}</div>}

        <section className="users-stat-grid">
          <article className="users-stat-card">
            <p>Total Visible Users</p>
            <h3>{loading ? "-" : baseRows.length}</h3>
          </article>
          <article className="users-stat-card">
            <p>Admins</p>
            <h3>{loading ? "-" : roleStats.Admin}</h3>
          </article>
          <article className="users-stat-card">
            <p>Courier Office Staff</p>
            <h3>{loading ? "-" : roleStats["Courier Office Staff"]}</h3>
          </article>
          <article className="users-stat-card">
            <p>Department Users</p>
            <h3>{loading ? "-" : roleStats["Department User"]}</h3>
          </article>
        </section>

        <section className="filter-card">
          <div className="search-filter-row">
            <input
              type="text"
              className="search-input"
              placeholder="Search by email, role, or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="inward-input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All Roles">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Courier Office Staff">Courier Office Staff</option>
              <option value="Department User">Department User</option>
            </select>
          </div>
        </section>

        <section className="dashboard-table-wrap users-table-wrap">
          <h3>Registered Users (excluding your account)</h3>
          <table className="mini-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Location</th>
                <th>Department</th>
                <th>Status</th>
                <th>Created On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8">Loading users...</td>
                </tr>
              ) : visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      {row.email}
                    </td>
                    <td>
                      {editingId === row.id ? (
                        <select
                          className="cell-inline-input"
                          value={drafts[row.id]?.role || "Department User"}
                          onChange={(e) => updateDraft(row.id, "role", e.target.value)}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Courier Office Staff">Courier Office Staff</option>
                          <option value="Department User">Department User</option>
                        </select>
                      ) : (
                        row.role
                      )}
                    </td>
                    <td>
                      {editingId === row.id ? (
                        <select
                          className="cell-inline-input"
                          value={drafts[row.id]?.location || ""}
                          onChange={(e) => updateDraft(row.id, "location", e.target.value)}
                          disabled={drafts[row.id]?.role === "Admin"}
                        >
                          <option value="">Select Location</option>
                          {LOCATIONS.map((location) => (
                            <option key={location} value={location}>
                              {location}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.location || "-"
                      )}
                    </td>
                    <td>
                      {editingId === row.id ? (
                        <select
                          className="cell-inline-input"
                          value={drafts[row.id]?.department || ""}
                          onChange={(e) => updateDraft(row.id, "department", e.target.value)}
                          disabled={drafts[row.id]?.role !== "Department User"}
                        >
                          <option value="">Select Department</option>
                          {((drafts[row.id]?.location && departmentsByLocation[drafts[row.id]?.location]) || []).map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.department || "-"
                      )}
                    </td>
                    <td>
                      <label className="status-toggle-wrap">
                        <input
                          type="checkbox"
                          checked={Boolean(row.isActive)}
                          onChange={() => toggleStatus(row)}
                        />
                        <span className={`status-chip ${row.isActive ? "active" : "inactive"}`}>
                          {row.isActive ? "Active" : "Disabled"}
                        </span>
                      </label>
                    </td>
                    <td>{row.createdAt ? String(row.createdAt).slice(0, 10) : "-"}</td>
                    <td>
                      <div className="users-action-row">
                        {editingId === row.id ? (
                          <>
                            <button type="button" className="row-action-btn save" onClick={() => saveEdit(row.id)}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="row-action-btn discard"
                              onClick={() => cancelEdit(row.id)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="row-action-btn" onClick={() => startEdit(row)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="row-action-btn discard"
                              onClick={() => deleteUser(row)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
