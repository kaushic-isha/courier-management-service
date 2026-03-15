import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";
import authFetch from "../utils/authFetch";

const API_BASE = "http://localhost:5000/api/outward/requests";
const VENDOR_OPTIONS = ["DTDC", "Bluedart", "Indiapost", "Speedpost", "Professional", "Other"];
const COURIER_TYPE_OPTIONS = ["Document", "Parcel", "Cheque", "Confidential", "Other"];

export default function DepartmentOutwardRequestPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "Department User") return <Navigate to="/main" replace />;

  const [form, setForm] = useState({
    department: user.department || "",
    origin: user.location || "Sadivayal Office",
    senderName: "",
    senderContact: "",
    vendor: "",
    parcels: "1",
    type: "",
    remarks: ""
  });
  const [saving, setSaving] = useState(false);

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
    if (!form.department || !form.origin || !form.senderName || !form.senderContact || !form.vendor || !form.parcels || !form.type) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      setSaving(true);
      const response = await authFetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: form.senderName.trim(),
          senderContact: form.senderContact.trim(),
          vendor: form.vendor,
          parcels: Number(form.parcels) || 1,
          type: form.type,
          remarks: form.remarks.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to submit request.");
      alert("Outward request submitted.");
      navigate("/main/department/outward");
    } catch (error) {
      alert(error.message || "Failed to submit request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath="/main/department/outward" user={user} onLogout={handleLogout} />
      <main className="main-content inward-page add-inward-page department-request-page">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/main/department" },
            { label: "Submit Outward Courier" }
          ]}
        />

        <div className="add-inward-title-row">
          <div>
            <h2>Submit Outward Courier Request</h2>
            <p>Fill in details to send request to courier office staff for dispatch.</p>
          </div>
        </div>

        <form className="add-inward-form" onSubmit={handleSubmit}>
          <section className="add-inward-card">
            <label className="add-label" htmlFor="department">Department Name <span className="required">*</span></label>
            <input id="department" className="add-input" type="text" value={form.department} disabled />

            <label className="add-label" htmlFor="origin">Origin Location <span className="required">*</span></label>
            <input id="origin" className="add-input" type="text" value={form.origin} disabled />

            <label className="add-label" htmlFor="senderName">Sender Name <span className="required">*</span></label>
            <input id="senderName" className="add-input" type="text" value={form.senderName} onChange={(e) => updateField("senderName", e.target.value)} required />

            <label className="add-label" htmlFor="senderContact">Sender Contact Number <span className="required">*</span></label>
            <input id="senderContact" className="add-input" type="text" value={form.senderContact} onChange={(e) => updateField("senderContact", e.target.value)} required />

            <label className="add-label" htmlFor="vendor">Courier Vendor <span className="required">*</span></label>
            <select id="vendor" className="add-input" value={form.vendor} onChange={(e) => updateField("vendor", e.target.value)} required>
              <option value="">Select courier vendor</option>
              {VENDOR_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <label className="add-label" htmlFor="parcels">Number of Parcels <span className="required">*</span></label>
            <input id="parcels" className="add-input" type="number" min="1" value={form.parcels} onChange={(e) => updateField("parcels", e.target.value)} required />

            <label className="add-label" htmlFor="type">Courier Type <span className="required">*</span></label>
            <select id="type" className="add-input" value={form.type} onChange={(e) => updateField("type", e.target.value)} required>
              <option value="">Select courier type</option>
              {COURIER_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <label className="add-label" htmlFor="remarks">Remarks (Optional)</label>
            <textarea id="remarks" className="add-input add-textarea" value={form.remarks} onChange={(e) => updateField("remarks", e.target.value)} />

            <div className="add-page-actions">
              <button type="submit" className="save-courier-btn" disabled={saving}>{saving ? "Submitting..." : "Submit Request"}</button>
              <button type="button" className="cancel-courier-btn" onClick={() => navigate("/main/department")}>Cancel</button>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
