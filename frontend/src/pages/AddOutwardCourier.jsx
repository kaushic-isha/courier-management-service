import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API_BASE = "http://localhost:5000/api/outward";
const AUTH_OPTIONS_API = "http://localhost:5000/api/auth/options";

const ORIGIN_OPTIONS = ["Sadivayal Office", "Ashram"];
const VENDOR_OPTIONS = ["DTDC", "Bluedart", "Indiapost", "Speedpost", "Professional", "Other"];
const COURIER_TYPE_OPTIONS = ["Document", "Parcel", "Cheque", "Confidential", "Other"];
const STATUS_OPTIONS = [
  { label: "Sent", value: "sent" },
  { label: "In Transit", value: "in-transit" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" }
];

function withDynamicOption(options, value) {
  if (!value) return options;
  return options.includes(value) ? options : [value, ...options];
}

function GuardAdminOrStaff({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (!["Admin", "Courier Office Staff"].includes(user.role)) return <Navigate to="/login" replace />;
  return null;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function defaultForm() {
  return {
    origin: "Sadivayal Office",
    docket: "",
    vendor: "",
    trackingNo: "",
    senderName: "",
    senderContact: "",
    senderDept: "",
    receiverName: "",
    receiverAddress: "",
    receiverContact: "",
    type: "",
    parcels: "1",
    weight: "",
    estCost: "",
    actualCost: "",
    status: "sent",
    dispatchDate: "",
    dispatchTime: "",
    deliveryDate: "",
    deliveryTime: "",
    remarks: ""
  };
}

export default function AddOutwardCourierPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId");
  const isRequestDispatchMode = Boolean(requestId) && !id;
  const isEditMode = Boolean(id);
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdminOrStaff({ user });
  if (guard) return guard;

  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditMode || isRequestDispatchMode);
  const [departmentsByLocation, setDepartmentsByLocation] = useState({});
  const lockedOrigin = user?.role === "Courier Office Staff" && user?.location ? user.location : "";
  const originOptions = withDynamicOption(ORIGIN_OPTIONS, lockedOrigin || form.origin);
  const vendorOptions = withDynamicOption(VENDOR_OPTIONS, form.vendor);
  const allDepartmentOptions = withDynamicOption(
    Array.from(new Set(Object.values(departmentsByLocation).flat())).sort((a, b) => a.localeCompare(b)),
    form.senderDept
  );
  const senderDepartmentOptions = withDynamicOption(
    lockedOrigin
      ? departmentsByLocation[lockedOrigin] || []
      : allDepartmentOptions,
    form.senderDept
  );
  const courierTypeOptions = withDynamicOption(COURIER_TYPE_OPTIONS, form.type);

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!lockedOrigin) return;
    setForm((prev) => (prev.origin === lockedOrigin ? prev : { ...prev, origin: lockedOrigin }));
  }, [lockedOrigin]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const response = await fetch(AUTH_OPTIONS_API);
        const data = await response.json();
        if (!response.ok) return;
        setDepartmentsByLocation(data.departmentsByLocation || {});
      } catch (_error) {
        setDepartmentsByLocation({});
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    async function loadEditRow() {
      if (!isEditMode && !isRequestDispatchMode) return;
      try {
        setLoading(true);
        const sourceId = isEditMode ? id : requestId;
        const response = await authFetch(`${API_BASE}/${sourceId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to load outward courier.");

        setForm((prev) => ({
          ...prev,
          origin: data.origin || "Sadivayal Office",
          docket: data.docket || "",
          vendor: data.vendor || "",
          trackingNo: data.trackingNo || "",
          senderName: data.senderName || "",
          senderContact: data.senderContact || "",
          senderDept: data.senderDept || data.department || "",
          receiverName: data.receiverName || "",
          receiverAddress: data.receiverAddress || "",
          receiverContact: data.receiverContact || "",
          type: data.type || "",
          parcels: String(data.parcels ?? "1"),
          weight: String(data.weight ?? ""),
          estCost: String(data.estCost ?? ""),
          actualCost: String(data.actualCost ?? ""),
          status: isRequestDispatchMode ? "sent" : data.status || "sent",
          dispatchDate: data.dispatchDate || "",
          dispatchTime: data.dispatchTime || "",
          deliveryDate: data.deliveryDate || "",
          deliveryTime: data.deliveryTime || "",
          remarks: data.remarks || ""
        }));
      } catch (error) {
        alert(error.message || "Failed to load outward courier.");
        navigate("/main/admin/requests");
      } finally {
        setLoading(false);
      }
    }

    loadEditRow();
  }, [id, requestId, isEditMode, isRequestDispatchMode, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (
      !form.docket ||
      !form.origin ||
      !form.vendor ||
      !form.senderName ||
      !form.senderContact ||
      !form.senderDept ||
      !form.receiverName ||
      !form.receiverAddress ||
      !form.receiverContact ||
      !form.type ||
      !form.parcels ||
      !form.weight ||
      !form.estCost ||
      !form.status ||
      !form.dispatchDate ||
      !form.dispatchTime
    ) {
      alert("Please fill all required fields.");
      return;
    }

    const payload = {
      docket: form.docket.trim(),
      department: form.senderDept,
      origin: lockedOrigin || form.origin,
      vendor: form.vendor,
      trackingNo: form.trackingNo.trim(),
      senderName: form.senderName.trim(),
      senderContact: form.senderContact.trim(),
      senderDept: form.senderDept,
      receiverName: form.receiverName.trim(),
      receiverAddress: form.receiverAddress.trim(),
      receiverContact: form.receiverContact.trim(),
      type: form.type,
      parcels: Number(form.parcels) || 1,
      weight: String(form.weight).trim(),
      estCost: String(form.estCost).trim(),
      actualCost: String(form.actualCost || "").trim(),
      status: form.status,
      dispatchDate: form.dispatchDate,
      dispatchTime: form.dispatchTime,
      deliveryDate: form.deliveryDate || null,
      deliveryTime: form.deliveryTime || null,
      remarks: form.remarks.trim(),
      ...(!isEditMode && !isRequestDispatchMode ? { dateOfEntry: todayString() } : {})
    };

    try {
      setSaving(true);
      const endpoint = isEditMode ? `${API_BASE}/${id}` : isRequestDispatchMode ? `${API_BASE}/${requestId}` : API_BASE;
      const method = isEditMode || isRequestDispatchMode ? "PATCH" : "POST";
      const response = await authFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      const modeLabel = isEditMode || isRequestDispatchMode ? "update" : "create";
      if (!response.ok) throw new Error(data.message || `Failed to ${modeLabel} outward courier.`);
      if (isEditMode) navigate(`/main/admin/outward/${id}`);
      else navigate("/main/admin/outward");
    } catch (error) {
      const modeLabel = isEditMode || isRequestDispatchMode ? "update" : "create";
      alert(error.message || `Failed to ${modeLabel} outward courier.`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="main-shell">
        <AdminHeader activePath="/main/admin/outward" user={user} onLogout={handleLogout} />
        <main className="main-content inward-page add-inward-page">
          <div>Loading courier details...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/outward" user={user} onLogout={handleLogout} />

      <main className="main-content inward-page add-inward-page">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/main/admin" },
            { label: "Outward Couriers", to: "/main/admin/outward" },
            { label: isEditMode ? "Edit Courier" : isRequestDispatchMode ? "Dispatch Request" : "Add Courier" }
          ]}
        />

        <div className="add-inward-title-row">
          <div>
            <h2>{isEditMode ? "Edit Outward Courier" : isRequestDispatchMode ? "Dispatch Outward Request" : "Add New Outward Courier"}</h2>
            <p>{isEditMode ? "Update the outward courier details" : isRequestDispatchMode ? "Review and complete details to dispatch this request" : "Fill in the details to register a new outward courier"}</p>
          </div>
          <button type="button" className="scan-btn">
            Scan Barcode/QR
          </button>
        </div>

        <form className="add-inward-form" onSubmit={handleSubmit}>
          <section className="add-inward-card">
            <h3>Dispatch Details</h3>

            <label className="add-label" htmlFor="origin">
              Origin <span className="required">*</span>
            </label>
            <select
              id="origin"
              className="add-input"
              value={lockedOrigin || form.origin}
              onChange={(e) => updateField("origin", e.target.value)}
              disabled={Boolean(lockedOrigin)}
              required
            >
              {originOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label className="add-label" htmlFor="docket">
              Docket Number <span className="required">*</span>
            </label>
            <input
              id="docket"
              className="add-input"
              type="text"
              placeholder="e.g., OUT-2024-1234"
              value={form.docket}
              onChange={(e) => updateField("docket", e.target.value)}
              required
            />

            <label className="add-label" htmlFor="vendor">
              Courier Vendor <span className="required">*</span>
            </label>
            <select
              id="vendor"
              className="add-input"
              value={form.vendor}
              onChange={(e) => updateField("vendor", e.target.value)}
              required
            >
              <option value="">Select Vendor</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>

            <label className="add-label" htmlFor="trackingNo">
              Consignment/Tracking Number
            </label>
            <input
              id="trackingNo"
              className="add-input"
              type="text"
              placeholder="e.g., TRK123456789"
              value={form.trackingNo}
              onChange={(e) => updateField("trackingNo", e.target.value)}
            />
          </section>

          <section className="add-inward-card">
            <h3>Sender & Receiver Details</h3>

            <div className="two-col-grid">
              <div>
                <label className="add-label" htmlFor="senderName">
                  Sender Name <span className="required">*</span>
                </label>
                <input
                  id="senderName"
                  className="add-input"
                  type="text"
                  placeholder="Enter sender name"
                  value={form.senderName}
                  onChange={(e) => updateField("senderName", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="add-label" htmlFor="senderContact">
                  Sender Contact Number <span className="required">*</span>
                </label>
                <input
                  id="senderContact"
                  className="add-input"
                  type="text"
                  placeholder="e.g., +91 98765 43210"
                  value={form.senderContact}
                  onChange={(e) => updateField("senderContact", e.target.value)}
                  required
                />
              </div>
            </div>

            <label className="add-label" htmlFor="senderDept">
              Sender Department <span className="required">*</span>
            </label>
            <select
              id="senderDept"
              className="add-input"
              value={form.senderDept}
              onChange={(e) => updateField("senderDept", e.target.value)}
              required
            >
              <option value="">Select Sender Department</option>
              {senderDepartmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <label className="add-label" htmlFor="receiverName">
              Receiver Name <span className="required">*</span>
            </label>
            <input
              id="receiverName"
              className="add-input"
              type="text"
              placeholder="Enter receiver name"
              value={form.receiverName}
              onChange={(e) => updateField("receiverName", e.target.value)}
              required
            />

            <label className="add-label" htmlFor="receiverAddress">
              Receiver Address <span className="required">*</span>
            </label>
            <textarea
              id="receiverAddress"
              className="add-input add-textarea"
              placeholder="Enter complete delivery address with city, state, and postal code"
              value={form.receiverAddress}
              onChange={(e) => updateField("receiverAddress", e.target.value)}
              required
            />

            <label className="add-label" htmlFor="receiverContact">
              Receiver Contact Number <span className="required">*</span>
            </label>
            <input
              id="receiverContact"
              className="add-input"
              type="text"
              placeholder="e.g., +91 98765 43210"
              value={form.receiverContact}
              onChange={(e) => updateField("receiverContact", e.target.value)}
              required
            />
          </section>

          <section className="add-inward-card">
            <h3>Parcel & Cost</h3>

            <label className="add-label" htmlFor="type">
              Courier Type <span className="required">*</span>
            </label>
            <select
              id="type"
              className="add-input"
              value={form.type}
              onChange={(e) => updateField("type", e.target.value)}
              required
            >
              <option value="">Select Courier Type</option>
              {courierTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <div className="two-col-grid">
              <div>
                <label className="add-label" htmlFor="parcels">
                  Number of Parcels <span className="required">*</span>
                </label>
                <input
                  id="parcels"
                  className="add-input"
                  type="number"
                  min="1"
                  placeholder="e.g., 3"
                  value={form.parcels}
                  onChange={(e) => updateField("parcels", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="add-label" htmlFor="weight">
                  Weight (kg) <span className="required">*</span>
                </label>
                <input
                  id="weight"
                  className="add-input"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g., 2.5"
                  value={form.weight}
                  onChange={(e) => updateField("weight", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="two-col-grid">
              <div>
                <label className="add-label" htmlFor="estCost">
                  Estimated Cost <span className="required">*</span>
                </label>
                <input
                  id="estCost"
                  className="add-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 45"
                  value={form.estCost}
                  onChange={(e) => updateField("estCost", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="add-label" htmlFor="actualCost">
                  Actual Cost
                </label>
                <input
                  id="actualCost"
                  className="add-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 42"
                  value={form.actualCost}
                  onChange={(e) => updateField("actualCost", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="add-inward-card">
            <h3>Status & Dates</h3>

            <label className="add-label" htmlFor="status">
              Status <span className="required">*</span>
            </label>
            <select
              id="status"
              className="add-input"
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <div className="two-col-grid">
              <div>
                <label className="add-label" htmlFor="dispatchDate">
                  Dispatch Date <span className="required">*</span>
                </label>
                <input
                  id="dispatchDate"
                  className="add-input"
                  type="date"
                  value={form.dispatchDate}
                  onChange={(e) => updateField("dispatchDate", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="add-label" htmlFor="dispatchTime">
                  Dispatch Time <span className="required">*</span>
                </label>
                <input
                  id="dispatchTime"
                  className="add-input"
                  type="time"
                  value={form.dispatchTime}
                  onChange={(e) => updateField("dispatchTime", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="two-col-grid">
              <div>
                <label className="add-label" htmlFor="deliveryDate">
                  Delivery Date
                </label>
                <input
                  id="deliveryDate"
                  className="add-input"
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => updateField("deliveryDate", e.target.value)}
                />
              </div>
              <div>
                <label className="add-label" htmlFor="deliveryTime">
                  Delivery Time
                </label>
                <input
                  id="deliveryTime"
                  className="add-input"
                  type="time"
                  value={form.deliveryTime}
                  onChange={(e) => updateField("deliveryTime", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="add-inward-card">
            <h3>Remarks</h3>
            <label className="add-label" htmlFor="remarks">
              Additional Notes
            </label>
            <textarea
              id="remarks"
              className="add-input add-textarea"
              placeholder="Enter any additional notes, special instructions, or delivery requirements..."
              value={form.remarks}
              onChange={(e) => updateField("remarks", e.target.value)}
            />
          </section>

          <div className="add-page-actions">
            <button type="submit" className="save-courier-btn" disabled={saving}>
              {saving ? "Saving..." : isEditMode || isRequestDispatchMode ? "Update Courier" : "Save Courier"}
            </button>
            <button
              type="button"
              className="cancel-courier-btn"
              onClick={() => navigate("/main/admin/outward")}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
