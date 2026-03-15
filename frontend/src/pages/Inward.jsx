import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API_BASE = "http://localhost:5000/api/inward";
const SELECTED_STORAGE_KEY = "inwardSelectedIds";
const VENDORS = ["All Vendors", "DTDC", "Bluedart", "Indiapost", "Speedpost", "Professional", "Other"];
const STATUS_LIST = ["All Status", "received", "handed-over", "discarded"];
const QUICK_RANGES = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "All Time"];

const COLUMNS = [
  { key: "docket", label: "Docket #" },
  { key: "status", label: "Status" },
  { key: "department", label: "Department" },
  { key: "source", label: "Source" },
  { key: "deliveredTo", label: "Delivered To" },
  { key: "vendor", label: "Vendor" },
  { key: "trackingNo", label: "Tracking #" },
  { key: "receiverName", label: "Receiver Name" },
  { key: "receiverContact", label: "Receiver Contact" },
  { key: "senderName", label: "Sender Name" },
  { key: "senderAddress", label: "Sender Address" },
  { key: "senderContact", label: "Sender Contact" },
  { key: "type", label: "Type" },
  { key: "parcels", label: "Parcels" },
  { key: "weight", label: "Weight" },
  { key: "receivedDate", label: "Received Date" },
  { key: "receivedTime", label: "Received Time" },
  { key: "collectedDate", label: "Collected Date" },
  { key: "collectedTime", label: "Collected Time" },
  { key: "collectorName", label: "Collector Name" },
  { key: "collectorContact", label: "Collector Contact Number" },
  { key: "remarks", label: "Remarks" },
  { key: "dateOfEntry", label: "Date of Entry" },
  { key: "lastEdited", label: "Last Edited" }
];

function parseDate(dateValue) {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

const READ_ONLY_COMPUTED_COLUMNS = new Set(["lastEdited", "collectorName", "collectorContact"]);

function formatStatus(status) {
  if (!status) return "-";
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function GuardAdminOrStaff({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (!["Admin", "Courier Office Staff", "Department User"].includes(user.role)) return <Navigate to="/login" replace />;
  return null;
}

export default function InwardPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdminOrStaff({ user });
  if (guard) return guard;
  const viewOnly = user?.role === "Department User";
  const homePath = viewOnly ? "/main/department" : "/main/admin";
  const activePath = viewOnly ? "/main/department/inward" : "/main/admin/inward";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [vendorFilter, setVendorFilter] = useState("All Vendors");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [quickRange, setQuickRange] = useState("All Time");
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingRowId, setEditingRowId] = useState(null);
  const [rowDrafts, setRowDrafts] = useState({});
  const [bulkMode, setBulkMode] = useState("collection");
  const [bulkCollectedDate, setBulkCollectedDate] = useState("");
  const [bulkCollectedTime, setBulkCollectedTime] = useState("");
  const [bulkCollectedBy, setBulkCollectedBy] = useState("");
  const [bulkCollectionRemarks, setBulkCollectionRemarks] = useState("");
  const [bulkParcels, setBulkParcels] = useState("");
  const [bulkWeight, setBulkWeight] = useState("");
  const [bulkParcelRemarks, setBulkParcelRemarks] = useState("");
  const [bulkStatus, setBulkStatus] = useState("received");

  async function fetchRows() {
    try {
      setLoading(true);
      const response = await authFetch(API_BASE);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch inward couriers.");
      setRows(data);
    } catch (error) {
      alert(error.message || "Failed to fetch inward couriers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    const savedSelected = sessionStorage.getItem(SELECTED_STORAGE_KEY);
    if (savedSelected) {
      try {
        setSelectedIds(JSON.parse(savedSelected));
      } catch (_error) {
        setSelectedIds([]);
      }
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(selectedIds));
  }, [selectedIds]);

  const filteredRows = useMemo(() => {
    let result = [...rows];
    const q = searchText.trim().toLowerCase();

    if (q) {
      result = result.filter((row) =>
        [
          row.docket,
          row.department,
          row.source,
          row.deliveredTo,
          row.trackingNo,
          row.receiverName,
          row.receiverContact,
          row.collectorName,
          row.collectorContact,
          row.senderName,
          row.senderContact
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (vendorFilter !== "All Vendors") result = result.filter((row) => row.vendor === vendorFilter);
    if (statusFilter !== "All Status") result = result.filter((row) => row.status === statusFilter);

    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    if (from || to) {
      result = result.filter((row) => {
        const rowDate = parseDate(row.dateOfEntry);
        if (!rowDate) return false;
        if (from && rowDate < from) return false;
        if (to && rowDate > to) return false;
        return true;
      });
    }

    return result;
  }, [rows, searchText, vendorFilter, statusFilter, fromDate, toDate]);

  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  function toggleSelectRow(rowId) {
    setSelectedIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      const visible = new Set(filteredRows.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !visible.has(id)));
      return;
    }
    setSelectedIds(Array.from(new Set([...selectedIds, ...filteredRows.map((r) => r.id)])));
  }

  function clearSelection() {
    setSelectedIds([]);
    sessionStorage.removeItem(SELECTED_STORAGE_KEY);
    resetBulkForm();
  }

  function resetBulkForm() {
    setBulkCollectedDate("");
    setBulkCollectedTime("");
    setBulkCollectedBy("");
    setBulkCollectionRemarks("");
    setBulkParcels("");
    setBulkWeight("");
    setBulkParcelRemarks("");
    setBulkStatus("received");
  }

  function applyQuickRange(range) {
    setQuickRange(range);
    if (range === "All Time") {
      setFromDate("");
      setToDate("");
      return;
    }

    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);
    if (range === "Yesterday") {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (range === "Last 7 Days") {
      start.setDate(today.getDate() - 6);
    } else if (range === "Last 30 Days") {
      start.setDate(today.getDate() - 29);
    }
    setFromDate(start.toISOString().slice(0, 10));
    setToDate(end.toISOString().slice(0, 10));
  }

  function startEdit(row) {
    setEditingRowId(row.id);
    setRowDrafts((prev) => ({ ...prev, [row.id]: { ...row } }));
  }

  function changeDraft(rowId, key, value) {
    setRowDrafts((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [key]: value } }));
  }

  async function saveEdit(rowId) {
    try {
      const draft = rowDrafts[rowId];
      if (!draft) return;

      const payload = { ...draft };
      delete payload.id;
      delete payload.lastEdited;
      delete payload.createdAt;
      delete payload.updatedAt;

      const response = await authFetch(`${API_BASE}/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save row.");

      setRows((prev) => prev.map((row) => (row.id === rowId ? data : row)));
      setEditingRowId(null);
    } catch (error) {
      alert(error.message || "Failed to save row.");
    }
  }

  function discardEdit(rowId) {
    setRowDrafts((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setEditingRowId(null);
  }

  async function applyBulkCollection() {
    try {
      const response = await authFetch(`${API_BASE}/bulk/collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          collectedDate: bulkCollectedDate,
          collectedTime: bulkCollectedTime,
          collectedBy: bulkCollectedBy,
          remarks: bulkCollectionRemarks
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Bulk collection update failed.");
      await fetchRows();
      clearSelection();
    } catch (error) {
      alert(error.message || "Bulk collection update failed.");
    }
  }

  async function applyBulkParcel() {
    try {
      const response = await authFetch(`${API_BASE}/bulk/parcel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          parcels: bulkParcels,
          weight: bulkWeight,
          remarks: bulkParcelRemarks
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Bulk parcel update failed.");
      await fetchRows();
      clearSelection();
    } catch (error) {
      alert(error.message || "Bulk parcel update failed.");
    }
  }

  async function applyBulkStatus() {
    try {
      const response = await authFetch(`${API_BASE}/bulk/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: bulkStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Bulk status update failed.");
      await fetchRows();
      clearSelection();
    } catch (error) {
      alert(error.message || "Bulk status update failed.");
    }
  }

  function renderCell(row, col) {
    const isEditing = editingRowId === row.id;
    if (!isEditing || READ_ONLY_COMPUTED_COLUMNS.has(col.key)) {
      if (col.key === "status") {
        const status = String(row[col.key] || "").trim();
        return <span className={`status-chip ${status}`}>{formatStatus(status)}</span>;
      }
      return <span>{row[col.key] ?? ""}</span>;
    }

    const draft = rowDrafts[row.id] || row;
    if (col.key === "status") {
      return (
        <select
          className="cell-input"
          value={draft[col.key]}
          onChange={(e) => changeDraft(row.id, col.key, e.target.value)}
        >
          <option value="received">received</option>
          <option value="handed-over">handed-over</option>
          <option value="discarded">discarded</option>
        </select>
      );
    }

    const type =
      col.key.includes("Date") || col.key === "dateOfEntry"
        ? "date"
        : col.key.includes("Time")
          ? "time"
          : col.key === "parcels" || col.key === "weight"
            ? "number"
            : "text";

    return (
      <input
        className="cell-input"
        type={type}
        value={draft[col.key] ?? ""}
        onChange={(e) => changeDraft(row.id, col.key, e.target.value)}
      />
    );
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath={activePath} user={user} onLogout={handleLogout} />

      <main className="main-content inward-page">
        <Breadcrumbs
          items={[
            { label: "Home", to: homePath },
            { label: "Inward Couriers" }
          ]}
        />

        <div className="inward-title-row">
          <div>
            <h2>Inward Courier List - All Details</h2>
            <p>{viewOnly ? "View incoming couriers for your department" : "Manage all incoming couriers with inline editing"}</p>
          </div>
          {!viewOnly && (
            <button
              type="button"
              className="add-courier-btn"
              onClick={() => navigate("/main/admin/inward/new")}
            >
              Add New Courier
            </button>
          )}
        </div>

        <section className="filter-card">
          <div className="search-filter-row">
            <input
              type="text"
              className="search-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by docket, names, contacts, or tracking number..."
            />
            <button type="button" className="filters-toggle-btn" onClick={() => setShowFilters((v) => !v)}>
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="filters-panel">
              <p className="filter-group-title">Quick Date Filters (Entry Date)</p>
              <div className="quick-filter-row">
                {QUICK_RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    className={`quick-chip ${quickRange === range ? "active" : ""}`}
                    onClick={() => applyQuickRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>

              <div className="filter-select-grid">
                <div>
                  <label className="small-label" htmlFor="vendorFilter">
                    Vendor
                  </label>
                  <select
                    id="vendorFilter"
                    className="inward-input"
                    value={vendorFilter}
                    onChange={(e) => setVendorFilter(e.target.value)}
                  >
                    {VENDORS.map((vendor) => (
                      <option key={vendor} value={vendor}>
                        {vendor}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="small-label" htmlFor="statusFilter">
                    Status
                  </label>
                  <select
                    id="statusFilter"
                    className="inward-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    {STATUS_LIST.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="filter-group-title">Custom Date Range (Entry Date)</p>
              <div className="date-grid">
                <div>
                  <label className="small-label" htmlFor="fromDate">
                    From Date
                  </label>
                  <input
                    id="fromDate"
                    className="inward-input"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="small-label" htmlFor="toDate">
                    To Date
                  </label>
                  <input
                    id="toDate"
                    className="inward-input"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {!viewOnly && <div className="table-meta action-meta">
          <div>
            Showing {filteredRows.length} of {rows.length} couriers{" "}
            {selectedIds.length > 0 && <span>({selectedIds.length} selected)</span>}
          </div>

          {selectedIds.length > 0 && (
            <div className="bulk-action-row">
              <span className="bulk-actions-label">Bulk Actions:</span>
              <button
                type="button"
                className={`bulk-pill collection ${bulkMode === "collection" ? "active" : ""}`}
                onClick={() => setBulkMode("collection")}
              >
                Collection
              </button>
              <button
                type="button"
                className={`bulk-pill parcel ${bulkMode === "parcel" ? "active" : ""}`}
                onClick={() => setBulkMode("parcel")}
              >
                Parcel
              </button>
              <button
                type="button"
                className={`bulk-pill status ${bulkMode === "status" ? "active" : ""}`}
                onClick={() => setBulkMode("status")}
              >
                Status
              </button>
              <button type="button" className="bulk-pill clear" onClick={clearSelection}>
                Clear
              </button>
            </div>
          )}
        </div>}

        {!viewOnly && selectedIds.length > 0 && (
          <section className="bulk-card">
            <div className="bulk-top-row">
              <strong>
                Apply {bulkMode === "collection" ? "Collection" : bulkMode === "parcel" ? "Parcel" : "Status"} update
                to {selectedIds.length} rows
              </strong>
            </div>

            {bulkMode === "collection" && (
              <div className="bulk-form-grid">
                <div>
                  <label className="small-label" htmlFor="bulkCollectedDate">
                    Collected Date
                  </label>
                  <input
                    id="bulkCollectedDate"
                    className="inward-input"
                    type="date"
                    value={bulkCollectedDate}
                    onChange={(e) => setBulkCollectedDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="small-label" htmlFor="bulkCollectedTime">
                    Collected Time
                  </label>
                  <input
                    id="bulkCollectedTime"
                    className="inward-input"
                    type="time"
                    value={bulkCollectedTime}
                    onChange={(e) => setBulkCollectedTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="small-label" htmlFor="bulkCollectedBy">
                    Collected By
                  </label>
                  <input
                    id="bulkCollectedBy"
                    className="inward-input"
                    type="text"
                    value={bulkCollectedBy}
                    onChange={(e) => setBulkCollectedBy(e.target.value)}
                    placeholder="Person name"
                  />
                </div>
                <div>
                  <label className="small-label" htmlFor="bulkCollectionRemarks">
                    Remarks
                  </label>
                  <input
                    id="bulkCollectionRemarks"
                    className="inward-input"
                    type="text"
                    value={bulkCollectionRemarks}
                    onChange={(e) => setBulkCollectionRemarks(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}

            {bulkMode === "parcel" && (
              <div className="bulk-form-grid">
                <div>
                  <label className="small-label" htmlFor="bulkParcels">
                    Parcels
                  </label>
                  <input
                    id="bulkParcels"
                    className="inward-input"
                    type="number"
                    min="0"
                    value={bulkParcels}
                    onChange={(e) => setBulkParcels(e.target.value)}
                  />
                </div>
                <div>
                  <label className="small-label" htmlFor="bulkWeight">
                    Weight
                  </label>
                  <input
                    id="bulkWeight"
                    className="inward-input"
                    type="text"
                    value={bulkWeight}
                    onChange={(e) => setBulkWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="small-label" htmlFor="bulkParcelRemarks">
                    Remarks
                  </label>
                  <input
                    id="bulkParcelRemarks"
                    className="inward-input"
                    type="text"
                    value={bulkParcelRemarks}
                    onChange={(e) => setBulkParcelRemarks(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}

            {bulkMode === "status" && (
              <div className="bulk-form-grid one-col">
                <div>
                  <label className="small-label" htmlFor="bulkStatus">
                    Status
                  </label>
                  <select
                    id="bulkStatus"
                    className="inward-input"
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                  >
                    <option value="received">received</option>
                    <option value="handed-over">handed-over</option>
                    <option value="discarded">discarded</option>
                  </select>
                </div>
              </div>
            )}

            <button
              type="button"
              className="apply-bulk-btn"
              onClick={
                bulkMode === "collection"
                  ? applyBulkCollection
                  : bulkMode === "parcel"
                    ? applyBulkParcel
                    : applyBulkStatus
              }
            >
              Apply {bulkMode === "collection" ? "Collection" : bulkMode === "parcel" ? "Parcel" : "Status"}
            </button>
          </section>
        )}

        <section className="table-card">
          {loading ? (
            <div>Loading inward couriers...</div>
          ) : (
            <div className="table-scroll">
              <table className="inward-table">
                <thead>
                  <tr>
                    {!viewOnly && (
                      <th className="sticky-check-col">
                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                      </th>
                    )}
                    {COLUMNS.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                    {!viewOnly && <th className="sticky-actions-col">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className={editingRowId === row.id ? "editing-row" : ""}>
                      {!viewOnly && (
                        <td className="sticky-check-col">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelectRow(row.id)}
                          />
                        </td>
                      )}
                      {COLUMNS.map((col) => (
                        <td key={col.key}>{renderCell(row, col)}</td>
                      ))}
                      {!viewOnly && <td className="sticky-actions-col">
                        {editingRowId === row.id ? (
                          <>
                            <button type="button" className="row-action-btn save" onClick={() => saveEdit(row.id)}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="row-action-btn discard"
                              onClick={() => discardEdit(row.id)}
                            >
                              Discard
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="row-action-btn"
                              onClick={() => navigate(`/main/admin/inward/${row.id}`)}
                            >
                              View
                            </button>
                            <button type="button" className="row-action-btn" onClick={() => startEdit(row)}>
                              Edit
                            </button>
                          </>
                        )}
                      </td>}
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
