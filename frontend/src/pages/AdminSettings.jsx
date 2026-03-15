import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const SETTINGS_API = "http://localhost:5000/api/settings";
const TARGET_KEYS = ["auth.roles", "outward.validStatuses"];
const SETTING_LABELS = {
  "auth.roles": "Roles",
  "outward.validStatuses": "Valid Statuses"
};

function GuardAdmin({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Courier Office Staff") return <Navigate to="/main/staff" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (user.role !== "Admin") return <Navigate to="/login" replace />;
  return null;
}

export default function AdminSettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdmin({ user });
  if (guard) return guard;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeKey, setActiveKey] = useState(TARGET_KEYS[0]);
  const [settingsMap, setSettingsMap] = useState({});
  const [newValueDraft, setNewValueDraft] = useState({});
  const [editingCell, setEditingCell] = useState({ key: "", index: -1 });
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    if (location.state?.activeKey && TARGET_KEYS.includes(location.state.activeKey)) {
      setActiveKey(location.state.activeKey);
    }
  }, [location.state]);

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        setError("");
        const settingsResponse = await authFetch(SETTINGS_API);
        const data = await settingsResponse.json();
        if (!settingsResponse.ok) throw new Error(data.message || "Failed to fetch admin settings.");
        const next = {};
        for (const key of TARGET_KEYS) next[key] = [];
        for (const row of Array.isArray(data) ? data : []) {
          next[row.key] = Array.isArray(row.value) ? row.value : [];
        }
        setSettingsMap(next);
      } catch (err) {
        setError(err.message || "Failed to fetch admin settings.");
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const rows = useMemo(
    () =>
      TARGET_KEYS.map((key) => ({
        key,
        values: Array.isArray(settingsMap[key]) ? settingsMap[key] : []
      })),
    [settingsMap]
  );
  const activeRow = rows.find((row) => row.key === activeKey) || rows[0];

  async function addValue(key) {
    const value = String(newValueDraft[key] || "").trim();
    if (!value) return;
    try {
      const existing = Array.isArray(settingsMap[key]) ? settingsMap[key] : [];
      if (existing.includes(value)) {
        alert("Value already exists.");
        return;
      }
      const values = [...existing, value];
      const response = await authFetch(`${SETTINGS_API}/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: values })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Failed to add value to ${key}.`);
      setSettingsMap((prev) => ({ ...prev, [key]: Array.isArray(data.value) ? data.value : values }));
      setNewValueDraft((prev) => ({ ...prev, [key]: "" }));
    } catch (err) {
      alert(err.message || `Failed to add value to ${key}.`);
    }
  }

  function startEdit(key, index, currentValue) {
    setEditingCell({ key, index });
    setEditDraft(currentValue);
  }

  function cancelEdit() {
    setEditingCell({ key: "", index: -1 });
    setEditDraft("");
  }

  async function saveEditedValue(key, index) {
    const nextValue = String(editDraft || "").trim();
    if (!nextValue) {
      alert("Value cannot be empty.");
      return;
    }
    try {
      const existing = Array.isArray(settingsMap[key]) ? settingsMap[key] : [];
      const values = existing.map((v, i) => (i === index ? nextValue : v));
      const response = await authFetch(`${SETTINGS_API}/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: values })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Failed to update value in ${key}.`);
      setSettingsMap((prev) => ({ ...prev, [key]: Array.isArray(data.value) ? data.value : values }));
      cancelEdit();
    } catch (err) {
      alert(err.message || `Failed to update value in ${key}.`);
    }
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/settings" user={user} onLogout={handleLogout} />
      <main className="main-content users-page">
        <Breadcrumbs items={[{ label: "Home", to: "/main/admin" }, { label: "Admin Settings" }]} />
        <h2>Admin Settings</h2>
        <p>Manage roles and outward status values, with department management on its own page.</p>

        {error && <div className="report-error">{error}</div>}

        {loading ? (
          <section className="table-card">
            <div>Loading settings...</div>
          </section>
        ) : (
          <>
            <section className="table-card">
              <div className="users-action-row settings-nav-row">
                <button
                  type="button"
                  className="row-action-btn"
                  onClick={() => navigate("/main/admin/settings/departments")}
                >
                  Manage Departments
                </button>
                {TARGET_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`row-action-btn ${activeKey === key ? "save" : ""}`}
                    onClick={() => {
                      setActiveKey(key);
                      cancelEdit();
                    }}
                  >
                    {SETTING_LABELS[key] || key}
                  </button>
                ))}
              </div>
            </section>

            {activeRow && (
              <section className="dashboard-table-wrap users-table-wrap settings-table-wrap" key={activeRow.key}>
                <h3>{SETTING_LABELS[activeRow.key] || activeRow.key}</h3>

                <div className="users-action-row settings-edit-row">
                  <input
                    type="text"
                    className="search-input"
                    placeholder={`Add new value to ${SETTING_LABELS[activeRow.key] || activeRow.key}`}
                    value={newValueDraft[activeRow.key] || ""}
                    onChange={(e) => setNewValueDraft((prev) => ({ ...prev, [activeRow.key]: e.target.value }))}
                  />
                  <button type="button" className="row-action-btn" onClick={() => addValue(activeRow.key)}>
                    Add
                  </button>
                </div>

                <table className="mini-table">
                  <thead>
                    <tr>
                      <th style={{ width: "80px" }}>#</th>
                      <th>Value</th>
                      <th style={{ width: "180px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRow.values.length ? (
                      activeRow.values.map((value, index) => (
                        <tr key={`${activeRow.key}-${index}`}>
                          <td>{index + 1}</td>
                          <td>
                            {editingCell.key === activeRow.key && editingCell.index === index ? (
                              <input
                                type="text"
                                className="cell-inline-input"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                              />
                            ) : (
                              value
                            )}
                          </td>
                          <td>
                            {editingCell.key === activeRow.key && editingCell.index === index ? (
                              <div className="users-action-row">
                                <button
                                  type="button"
                                  className="row-action-btn save"
                                  onClick={() => saveEditedValue(activeRow.key, index)}
                                >
                                  Save
                                </button>
                                <button type="button" className="row-action-btn discard" onClick={cancelEdit}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="row-action-btn"
                                onClick={() => startEdit(activeRow.key, index, value)}
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3">No values configured.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
