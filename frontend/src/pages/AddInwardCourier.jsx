import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API_BASE = "http://localhost:5000/api/inward";
const AUTH_OPTIONS_API = "http://localhost:5000/api/auth/options";

const SOURCE_TYPES = [
  "Sadivayal Office",
  "Ashram",
  "Other Vendors",
  "Samskriti Parents",
  "IHS Parents",
  "Singanallur"
];

const DELIVERED_TO_OPTIONS = ["Sadivayal Office", "Ashram"];
const VENDOR_OPTIONS = ["DTDC", "Bluedart", "Indiapost", "Speedpost", "Professional", "Other"];
const COURIER_TYPE_OPTIONS = ["Document", "Parcel", "Cheque", "Confidential", "Other"];
const STATUS_OPTIONS = [
  { label: "Received", value: "received" },
  { label: "Handed Over", value: "handed-over" },
  { label: "Discarded", value: "discarded" }
];

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
    source: "Other Vendors",
    deliveredTo: "Ashram",
    docket: "",
    vendor: "",
    trackingNo: "",
    senderName: "",
    senderContact: "",
    senderAddress: "",
    receiverName: "",
    receiverContact: "",
    receiverDepartment: "",
    type: "",
    parcels: "1",
    status: "received",
    receivedDate: "",
    receivedTime: "",
    rackNumber: "",
    collectedByName: "",
    sameAsReceiver: false,
    collectedByContact: "",
    collectionDate: "",
    collectionTime: "",
    remarks: ""
  };
}

function parseRemarksForForm(remarks = "") {
  const text = String(remarks || "");
  const findFirst = (patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return "";
  };

  // Handle legacy free-text variants first (single line, comma separated, new line, etc.)
  const regexRack = [
    /rack\s*(?:number)?\s*:\s*([^|\n,]+)/i
  ];
  const regexCollectedBy = [
    /collected\s*by\s*(?:name)?\s*:\s*([^|\n,]+)/i,
    /collector\s*name\s*:\s*([^|\n,]+)/i
  ];
  const regexCollectorContact = [
    /collector\s*contact(?:\s*number)?\s*:\s*([^|\n,]+)/i,
    /collected\s*by\s*contact(?:\s*number)?\s*:\s*([^|\n,]+)/i
  ];

  const parts = text
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  let rackNumber = findFirst(regexRack);
  let collectedByName = findFirst(regexCollectedBy);
  let collectedByContact = findFirst(regexCollectorContact);
  const freeTextParts = [];

  for (const part of parts) {
    if (/^rack\s*:/i.test(part)) {
      rackNumber = part.replace(/^rack\s*:/i, "").trim();
    } else if (/^collected\s*by\s*:/i.test(part)) {
      collectedByName = part.replace(/^collected\s*by\s*:/i, "").trim();
    } else if (/^collector\s*contact\s*:/i.test(part)) {
      collectedByContact = part.replace(/^collector\s*contact\s*:/i, "").trim();
    } else {
      freeTextParts.push(part);
    }
  }

  return {
    rackNumber,
    collectedByName,
    collectedByContact,
    remarks: freeTextParts.join(" | ")
  };
}

function withDynamicOption(options, value) {
  if (!value) return options;
  return options.includes(value) ? options : [value, ...options];
}

export default function AddInwardCourierPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const guard = GuardAdminOrStaff({ user });
  if (guard) return guard;

  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [existingRow, setExistingRow] = useState(null);
  const [departmentsByLocation, setDepartmentsByLocation] = useState({});
  const lockedDeliveredTo = user?.role === "Courier Office Staff" ? user.location || "" : "";
  const sourceOptions = withDynamicOption(SOURCE_TYPES, form.source);
  const deliveredToOptions = withDynamicOption(DELIVERED_TO_OPTIONS, lockedDeliveredTo || form.deliveredTo);
  const vendorOptions = withDynamicOption(VENDOR_OPTIONS, form.vendor);
  const allDepartmentOptions = Object.values(departmentsByLocation).flat();
  const filteredDepartmentOptions = user?.role === "Admin"
    ? allDepartmentOptions
    : ((form.deliveredTo && departmentsByLocation[form.deliveredTo]) || []);
  const departmentOptions = withDynamicOption(filteredDepartmentOptions, form.receiverDepartment);
  const courierTypeOptions = withDynamicOption(COURIER_TYPE_OPTIONS, form.type);

  useEffect(() => {
    if (!lockedDeliveredTo) return;
    setForm((prev) => (
      prev.deliveredTo === lockedDeliveredTo
        ? prev
        : { ...prev, deliveredTo: lockedDeliveredTo }
    ));
  }, [lockedDeliveredTo]);

  useEffect(() => {
    async function loadDepartmentOptions() {
      try {
        const response = await fetch(AUTH_OPTIONS_API);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to load departments.");
        setDepartmentsByLocation(data.departmentsByLocation || {});
      } catch (_error) {
        setDepartmentsByLocation({});
      }
    }

    loadDepartmentOptions();
  }, []);

  useEffect(() => {
    if (user?.role === "Admin") return;
    if (!form.deliveredTo) return;
    if ((departmentsByLocation[form.deliveredTo] || []).includes(form.receiverDepartment)) return;
    setForm((prev) => ({ ...prev, receiverDepartment: "" }));
  }, [departmentsByLocation, form.deliveredTo, form.receiverDepartment, user?.role]);

  useEffect(() => {
    if (!form.sameAsReceiver) return;
    setForm((prev) => ({
      ...prev,
      collectedByName: prev.receiverName,
      collectedByContact: prev.receiverContact
    }));
  }, [form.sameAsReceiver, form.receiverName, form.receiverContact]);

  useEffect(() => {
    async function loadRowForEdit() {
      if (!isEditMode) return;
      try {
        setLoading(true);
        const response = await authFetch(`${API_BASE}/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to load courier.");

        const parsedRemarks = parseRemarksForForm(data.remarks || "");
        setExistingRow(data);
        const fallbackCollectorName =
          parsedRemarks.collectedByName ||
          data.collectedByName ||
          (data.collectedDate || data.collectedTime ? data.receiverName || "" : "");
        const fallbackCollectorContact =
          parsedRemarks.collectedByContact ||
          data.collectedByContact ||
          (data.collectedDate || data.collectedTime ? data.receiverContact || "" : "");
        setForm((prev) => ({
          ...prev,
          source: data.source || "Other Vendors",
          deliveredTo: data.deliveredTo || "Ashram",
          docket: data.docket || "",
          vendor: data.vendor || "",
          trackingNo: data.trackingNo || "",
          senderName: data.senderName || "",
          senderContact: data.senderContact || "",
          senderAddress: data.senderAddress || "",
          receiverName: data.receiverName || "",
          receiverContact: data.receiverContact || "",
          receiverDepartment: data.department || "",
          type: data.type || "",
          parcels: String(data.parcels ?? "1"),
          status: data.status || "received",
          receivedDate: data.receivedDate || "",
          receivedTime: data.receivedTime || "",
          rackNumber: parsedRemarks.rackNumber || "",
          collectedByName: fallbackCollectorName,
          sameAsReceiver: false,
          collectedByContact: fallbackCollectorContact,
          collectionDate: data.collectedDate || "",
          collectionTime: data.collectedTime || "",
          remarks: parsedRemarks.remarks || ""
        }));
      } catch (error) {
        alert(error.message || "Failed to load courier.");
        navigate("/main/admin/inward");
      } finally {
        setLoading(false);
      }
    }

    loadRowForEdit();
  }, [id, isEditMode, navigate]);

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (
      !form.source ||
      !form.deliveredTo ||
      !form.docket ||
      !form.vendor ||
      !form.senderName ||
      !form.senderContact ||
      !form.receiverName ||
      !form.receiverContact
    ) {
      alert("Please fill all required fields.");
      return;
    }
    if (!form.receiverDepartment) {
      alert("Please select receiver department.");
      return;
    }
    if (!form.type) {
      alert("Please select courier type.");
      return;
    }

    const remarkParts = [];
    if (form.rackNumber.trim()) remarkParts.push(`Rack: ${form.rackNumber.trim()}`);
    if (form.collectedByName.trim()) remarkParts.push(`Collected By: ${form.collectedByName.trim()}`);
    if (form.collectedByContact.trim()) remarkParts.push(`Collector Contact: ${form.collectedByContact.trim()}`);
    if (form.remarks.trim()) remarkParts.push(form.remarks.trim());

    const payload = {
      docket: form.docket.trim(),
      department: form.receiverDepartment,
      source: form.source,
      deliveredTo: lockedDeliveredTo || form.deliveredTo,
      vendor: form.vendor,
      trackingNo: form.trackingNo.trim(),
      receiverName: form.receiverName.trim(),
      receiverContact: form.receiverContact.trim(),
      senderName: form.senderName.trim(),
      senderAddress: form.senderAddress.trim(),
      senderContact: form.senderContact.trim(),
      type: form.type,
      parcels: Number(form.parcels) || 1,
      weight: existingRow?.weight || "0",
      status: form.status,
      receivedDate: form.receivedDate || todayString(),
      receivedTime: form.receivedTime || "",
      collectedDate: form.collectionDate || null,
      collectedTime: form.collectionTime || null,
      remarks: remarkParts.join(" | "),
      dateOfEntry: existingRow?.dateOfEntry || todayString()
    };

    try {
      setSaving(true);
      const response = await authFetch(isEditMode ? `${API_BASE}/${id}` : API_BASE, {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Failed to ${isEditMode ? "update" : "create"} courier.`);
      navigate(isEditMode ? `/main/admin/inward/${id}` : "/main/admin/inward");
    } catch (error) {
      alert(error.message || `Failed to ${isEditMode ? "update" : "create"} courier.`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="main-shell">
        <AdminHeader activePath="/main/admin/inward" user={user} onLogout={handleLogout} />
        <main className="main-content inward-page add-inward-page">
          <div>Loading courier details...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/admin/inward" user={user} onLogout={handleLogout} />

      <main className="main-content inward-page add-inward-page">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/main/admin" },
            { label: "Inward Couriers", to: "/main/admin/inward" },
            { label: isEditMode ? "Edit Courier" : "Add New Courier" }
          ]}
        />

        <div className="add-inward-title-row">
          <div>
            <h2>{isEditMode ? "Edit Inward Courier" : "Add New Inward Courier"}</h2>
            <p>{isEditMode ? "Update the details of this inward courier" : "Fill in the details to register a new inward courier"}</p>
          </div>
          <button type="button" className="scan-btn">
            Scan Barcode/QR
          </button>
        </div>

        <form className="add-inward-form" onSubmit={handleSubmit}>
          <section className="add-inward-card">
            <h3>Courier Details</h3>
            <label className="add-label">
              Courier Source Type <span className="required">*</span>
            </label>
            <div className="source-radio-grid">
              {sourceOptions.map((source) => (
                <label key={source} className="source-radio-option">
                  <input
                    type="radio"
                    name="source"
                    value={source}
                    checked={form.source === source}
                    onChange={(e) => updateField("source", e.target.value)}
                  />
                  <span>{source}</span>
                </label>
              ))}
            </div>

            <label className="add-label" htmlFor="docket">
              Delivered To <span className="required">*</span>
            </label>
            <select
              id="deliveredTo"
              className="add-input"
              value={lockedDeliveredTo || form.deliveredTo}
              onChange={(e) => updateField("deliveredTo", e.target.value)}
              disabled={Boolean(lockedDeliveredTo)}
              required
            >
              <option value="">Select Destination</option>
              {deliveredToOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
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
              placeholder="e.g. DKT-2024-1234"
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
              placeholder="e.g. TRK123456789"
              value={form.trackingNo}
              onChange={(e) => updateField("trackingNo", e.target.value)}
            />
          </section>

          <section className="add-inward-card">
            <h3>Sender & Receiver Details</h3>

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

            <label className="add-label" htmlFor="senderAddress">
              Sender Address
            </label>
            <textarea
              id="senderAddress"
              className="add-input add-textarea"
              placeholder="Enter sender address (optional)"
              value={form.senderAddress}
              onChange={(e) => updateField("senderAddress", e.target.value)}
            />

            <div className="two-col-grid">
              <div>
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
              </div>
              <div>
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
              </div>
            </div>

            <label className="add-label" htmlFor="receiverDepartment">
              Receiver Department
            </label>
            <select
              id="receiverDepartment"
              className="add-input"
              value={form.receiverDepartment}
              onChange={(e) => updateField("receiverDepartment", e.target.value)}
            >
              <option value="">Select Receiver Department</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <label className="add-label" htmlFor="courierType">
              Courier Type
            </label>
            <select
              id="courierType"
              className="add-input"
              value={form.type}
              onChange={(e) => updateField("type", e.target.value)}
            >
              <option value="">Select Courier Type</option>
              {courierTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </section>

          <section className="add-inward-card">
            <h3>Parcel & Status</h3>
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
              </div>
            </div>

            <div className="two-col-grid">
              <div>
                <label className="add-label" htmlFor="receivedDate">
                  Received Date <span className="required">*</span>
                </label>
                <input
                  id="receivedDate"
                  className="add-input"
                  type="date"
                  value={form.receivedDate}
                  onChange={(e) => updateField("receivedDate", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="add-label" htmlFor="receivedTime">
                  Received Time
                </label>
                <input
                  id="receivedTime"
                  className="add-input"
                  type="time"
                  value={form.receivedTime}
                  onChange={(e) => updateField("receivedTime", e.target.value)}
                />
              </div>
            </div>

            <label className="add-label" htmlFor="rackNumber">
              Rack Number
            </label>
            <input
              id="rackNumber"
              className="add-input"
              type="text"
              placeholder="e.g., A-15"
              value={form.rackNumber}
              onChange={(e) => updateField("rackNumber", e.target.value)}
            />
          </section>

          <section className="add-inward-card">
            <h3>Collection Details</h3>

            <label className="same-receiver-row">
              <input
                type="checkbox"
                checked={form.sameAsReceiver}
                onChange={(e) => updateField("sameAsReceiver", e.target.checked)}
              />
              <span>Same as receiver</span>
            </label>

            <label className="add-label" htmlFor="collectedByName">
              Collected By Name
            </label>
            <input
              id="collectedByName"
              className="add-input"
              type="text"
              placeholder="Enter collector name"
              value={form.collectedByName}
              onChange={(e) => updateField("collectedByName", e.target.value)}
            />

            <label className="add-label" htmlFor="collectedByContact">
              Collected By Contact Number
            </label>
            <input
              id="collectedByContact"
              className="add-input"
              type="text"
              placeholder="e.g., +91 98765 43210"
              value={form.collectedByContact}
              onChange={(e) => updateField("collectedByContact", e.target.value)}
            />

            <div className="two-col-grid">
              <div>
                <label className="add-label" htmlFor="collectionDate">
                  Collection Date
                </label>
                <input
                  id="collectionDate"
                  className="add-input"
                  type="date"
                  value={form.collectionDate}
                  onChange={(e) => updateField("collectionDate", e.target.value)}
                />
              </div>
              <div>
                <label className="add-label" htmlFor="collectionTime">
                  Collection Time
                </label>
                <input
                  id="collectionTime"
                  className="add-input"
                  type="time"
                  value={form.collectionTime}
                  onChange={(e) => updateField("collectionTime", e.target.value)}
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
              placeholder="Enter any additional notes or remarks..."
              value={form.remarks}
              onChange={(e) => updateField("remarks", e.target.value)}
            />
          </section>

          <div className="add-page-actions">
            <button type="submit" className="save-courier-btn" disabled={saving}>
              {saving ? "Saving..." : isEditMode ? "Update Courier" : "Save Courier"}
            </button>
            <button
              type="button"
              className="cancel-courier-btn"
              onClick={() => navigate("/main/admin/inward")}
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
