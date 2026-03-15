import express from "express";
import { Op } from "sequelize";
import OutwardCourier from "../models/OutwardCourier.js";
import SystemSetting from "../models/SystemSetting.js";

const router = express.Router();
const ORIGIN_OPTIONS = ["Sadivayal Office", "Ashram"];

function isAdminOrStaff(req) {
  return ["Admin", "Courier Office Staff"].includes(req.auth?.role);
}

function isDepartmentUser(req) {
  return req.auth?.role === "Department User";
}

function canAccessOutward(req, row) {
  if (req.auth?.role === "Admin") return true;
  if (isDepartmentUser(req)) {
    if (row.department !== req.auth.department) return false;
    if (req.auth.location && row.origin !== req.auth.location) return false;
    return true;
  }
  if (req.auth?.role === "Courier Office Staff") {
    if (req.auth.location && row.origin !== req.auth.location) return false;
    return true;
  }
  return false;
}

function formatLastEdited(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const formattedDate = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const formattedTime = date.toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata"
  });
  return `${formattedDate} ${formattedTime}`;
}

function toResponse(row) {
  const data = row.toJSON();
  let parsedTimeline = [];
  if (data.statusTimeline) {
    try {
      const timeline = JSON.parse(data.statusTimeline);
      parsedTimeline = Array.isArray(timeline) ? timeline : [];
    } catch (_error) {
      parsedTimeline = [];
    }
  }
  return {
    ...data,
    statusTimeline: parsedTimeline,
    lastEdited: formatLastEdited(data.updatedAt)
  };
}

function getDefaultEditableFields() {
  const blocked = new Set(["id", "createdAt", "updatedAt", "statusTimeline"]);
  return Object.keys(OutwardCourier.rawAttributes).filter((k) => !blocked.has(k));
}

async function getRequiredSetting(key) {
  const row = await SystemSetting.findOne({ where: { key } });
  if (!row?.value) {
    throw new Error(`Missing required system setting: ${key}`);
  }
  return row.value;
}

async function getEditableFields() {
  const defaultFields = getDefaultEditableFields();
  const raw = await getRequiredSetting("outward.editableFields");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("outward.editableFields must be a JSON array.");
    }
    const allowedSet = new Set(defaultFields);
    const filtered = parsed.filter((field) => allowedSet.has(field));
    if (!filtered.includes("origin") && allowedSet.has("origin")) {
      filtered.push("origin");
    }
    if (!filtered.length) {
      throw new Error("outward.editableFields contains no valid model fields.");
    }
    return filtered;
  } catch (_error) {
    throw new Error("Invalid system setting: outward.editableFields");
  }
}

async function getValidStatuses() {
  const raw = await getRequiredSetting("outward.validStatuses");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error("outward.validStatuses must be a non-empty JSON array.");
    }
    return parsed;
  } catch (_error) {
    throw new Error("Invalid system setting: outward.validStatuses");
  }
}

async function getStatusMeta() {
  const raw = await getRequiredSetting("outward.statusMeta");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("outward.statusMeta must be a JSON object.");
    }
    return parsed;
  } catch (_error) {
    throw new Error("Invalid system setting: outward.statusMeta");
  }
}

async function buildTimelineEntry(status, date, time, noteOverride = "") {
  const now = new Date();
  const fallbackDate = now.toISOString().slice(0, 10);
  const fallbackTime = now.toTimeString().slice(0, 5);
  const statusMeta = await getStatusMeta();
  const meta = statusMeta[status] || { title: status, note: "" };
  return {
    status,
    title: meta.title,
    date: date || fallbackDate,
    time: time || fallbackTime,
    note: noteOverride || meta.note
  };
}

async function normalizeTimeline(rawTimeline, row) {
  let timeline = [];
  if (rawTimeline) {
    try {
      const parsed = JSON.parse(rawTimeline);
      timeline = Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      timeline = [];
    }
  }

  if (!timeline.length) {
    timeline = [await buildTimelineEntry(row.status, row.dispatchDate, row.dispatchTime)];
  }
  return timeline;
}

async function applyStatusChangeWithTimeline(row, nextStatus, opts = {}) {
  const currentStatus = row.status;
  const validStatuses = await getValidStatuses();
  if (!validStatuses.includes(nextStatus)) return false;
  if (currentStatus === nextStatus) return false;

  row.status = nextStatus;
  const timeline = await normalizeTimeline(row.statusTimeline, row);
  const last = timeline[0];

  if (last?.status !== nextStatus) {
    timeline.unshift(
      await buildTimelineEntry(
        nextStatus,
        opts.date || row.deliveryDate || row.dispatchDate,
        opts.time || row.deliveryTime || row.dispatchTime,
        opts.note || ""
      )
    );
    row.statusTimeline = JSON.stringify(timeline);
  }
  return true;
}

function ensureDeliveredFields(row, preferredDate = null, preferredTime = null) {
  if (row.status !== "delivered") return;
  const now = new Date();
  if (!row.deliveryDate) row.deliveryDate = preferredDate || now.toISOString().slice(0, 10);
  if (!row.deliveryTime) row.deliveryTime = preferredTime || now.toTimeString().slice(0, 5);
}

router.get("/", async (req, res) => {
  try {
    if (!req.auth?.role) return res.status(403).json({ message: "Access denied." });

    const where = {};
    if (isDepartmentUser(req)) {
      where.department = req.auth.department;
      if (req.auth.location) where.origin = req.auth.location;
    } else if (req.auth?.role === "Courier Office Staff" && req.auth.location) {
      where.origin = req.auth.location;
    }

    const rows = await OutwardCourier.findAll({ where, order: [["id", "ASC"]] });
    return res.json(rows.map(toResponse));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch outward couriers.", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const payload = {
      docket: (req.body.docket || "").trim(),
      department: (req.body.department || "").trim(),
      origin: (req.body.origin || "").trim(),
      vendor: (req.body.vendor || "").trim(),
      trackingNo: (req.body.trackingNo || "").trim(),
      senderName: (req.body.senderName || "").trim(),
      senderContact: (req.body.senderContact || "").trim(),
      senderDept: (req.body.senderDept || "").trim(),
      receiverName: (req.body.receiverName || "").trim(),
      receiverAddress: (req.body.receiverAddress || "").trim(),
      receiverContact: (req.body.receiverContact || "").trim(),
      type: (req.body.type || "").trim(),
      parcels: Number(req.body.parcels) || 1,
      weight: req.body.weight ? String(req.body.weight) : "0",
      estCost: req.body.estCost ? String(req.body.estCost) : "0",
      actualCost: req.body.actualCost ? String(req.body.actualCost) : "",
      status: req.body.status || "sent",
      dispatchDate: req.body.dispatchDate || null,
      dispatchTime: req.body.dispatchTime || "",
      deliveryDate: req.body.deliveryDate || null,
      deliveryTime: req.body.deliveryTime || null,
      remarks: req.body.remarks || "",
      dateOfEntry: req.body.dateOfEntry || null
    };

    if (
      !payload.docket ||
      !payload.department ||
      !payload.origin ||
      !payload.vendor ||
      !payload.senderName ||
      !payload.senderContact ||
      !payload.senderDept ||
      !payload.receiverName ||
      !payload.receiverAddress ||
      !payload.receiverContact ||
      !payload.type ||
      !payload.dispatchDate ||
      !payload.dispatchTime ||
      !payload.dateOfEntry
    ) {
      return res.status(400).json({ message: "Missing required outward courier fields." });
    }

    if (!ORIGIN_OPTIONS.includes(payload.origin)) {
      return res.status(400).json({ message: "Invalid origin selected." });
    }

    if (req.auth?.role === "Courier Office Staff" && req.auth.location && payload.origin !== req.auth.location) {
      return res.status(403).json({ message: "You can only create outward couriers for your assigned location." });
    }

    const validStatuses = await getValidStatuses();
    if (!validStatuses.includes(payload.status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    payload.statusTimeline = JSON.stringify([
      await buildTimelineEntry(payload.status, payload.dispatchDate, payload.dispatchTime)
    ]);

    if (payload.status === "delivered") {
      const now = new Date();
      if (!payload.deliveryDate) payload.deliveryDate = now.toISOString().slice(0, 10);
      if (!payload.deliveryTime) payload.deliveryTime = now.toTimeString().slice(0, 5);
    }

    const row = await OutwardCourier.create(payload);
    return res.status(201).json(toResponse(row));
  } catch (error) {
    return res.status(500).json({ message: "Failed to create outward courier.", error: error.message });
  }
});

router.post("/requests", async (req, res) => {
  try {
    if (!isDepartmentUser(req)) {
      return res.status(403).json({ message: "Only department users can submit requests." });
    }

    const payload = {
      docket: `REQ-${Date.now()}`,
      department: (req.auth.department || "").trim(),
      origin: (req.auth.location || "").trim(),
      vendor: (req.body.vendor || "").trim(),
      trackingNo: "",
      senderName: (req.body.senderName || "").trim(),
      senderContact: (req.body.senderContact || "").trim(),
      senderDept: (req.auth.department || "").trim(),
      receiverName: "Pending Dispatch",
      receiverAddress: "Pending Dispatch",
      receiverContact: "Pending",
      type: (req.body.type || "").trim(),
      parcels: Number(req.body.parcels) || 1,
      weight: "0",
      estCost: "0",
      actualCost: "0",
      status: "requested",
      dispatchDate: new Date().toISOString().slice(0, 10),
      dispatchTime: "00:00",
      deliveryDate: null,
      deliveryTime: null,
      remarks: (req.body.remarks || "").trim(),
      dateOfEntry: new Date().toISOString().slice(0, 10)
    };

    if (!payload.department || !payload.origin || !payload.vendor || !payload.senderName || !payload.senderContact || !payload.type) {
      return res.status(400).json({ message: "Missing required request fields." });
    }

    if (!ORIGIN_OPTIONS.includes(payload.origin)) {
      return res.status(400).json({ message: "Invalid origin selected." });
    }

    payload.statusTimeline = JSON.stringify([
      await buildTimelineEntry("requested", payload.dispatchDate, payload.dispatchTime)
    ]);

    const row = await OutwardCourier.create(payload);
    return res.status(201).json(toResponse(row));
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit outward request.", error: error.message });
  }
});

router.get("/requests", async (req, res) => {
  try {
    if (!req.auth?.role) return res.status(403).json({ message: "Access denied." });

    const where = { docket: { [Op.like]: "REQ-%" } };
    if (isDepartmentUser(req)) {
      where.department = req.auth.department;
      if (req.auth.location) where.origin = req.auth.location;
    }

    const rows = await OutwardCourier.findAll({ where, order: [["id", "DESC"]] });
    return res.json(rows.map(toResponse));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch request list.", error: error.message });
  }
});

router.get("/requests/pending/list", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const where = { status: "requested", docket: { [Op.like]: "REQ-%" } };
    if (req.auth?.role === "Courier Office Staff" && req.auth.location) {
      where.origin = req.auth.location;
    }

    const rows = await OutwardCourier.findAll({ where, order: [["id", "DESC"]] });
    return res.json(rows.map(toResponse));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch outward requests.", error: error.message });
  }
});

router.post("/requests/:id/action", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    const { action } = req.body;
    if (!["dispatch", "cancel"].includes(action)) {
      return res.status(400).json({ message: "Invalid action." });
    }

    const row = await OutwardCourier.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Request not found." });
    if (row.status !== "requested") return res.status(400).json({ message: "Only requested rows can be processed." });
    if (!canAccessOutward(req, row)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    if (action === "dispatch") {
      const now = new Date();
      row.dispatchDate = now.toISOString().slice(0, 10);
      row.dispatchTime = now.toTimeString().slice(0, 5);
      await applyStatusChangeWithTimeline(row, "sent", { note: "Request dispatched by courier office staff" });
    } else {
      await applyStatusChangeWithTimeline(row, "cancelled", { note: "Request cancelled by courier office staff" });
    }

    await row.save();
    return res.json(toResponse(row));
  } catch (error) {
    return res.status(500).json({ message: "Failed to process outward request.", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await OutwardCourier.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Courier not found." });
    if (!canAccessOutward(req, row)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    return res.json(toResponse(row));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch courier.", error: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const row = await OutwardCourier.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Courier not found." });
    if (!canAccessOutward(req, row)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const validStatuses = await getValidStatuses();
    if (Object.prototype.hasOwnProperty.call(req.body, "status") && !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "origin") && !ORIGIN_OPTIONS.includes(req.body.origin)) {
      return res.status(400).json({ message: "Invalid origin selected." });
    }

    const editableFields = await getEditableFields();
    for (const key of editableFields) {
      if (key === "status") continue;
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        row[key] = req.body[key];
      }
    }

    if (req.auth?.role === "Courier Office Staff" && req.auth.location && row.origin !== req.auth.location) {
      return res.status(403).json({ message: "You can only update outward couriers for your assigned location." });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
      const changed = await applyStatusChangeWithTimeline(row, req.body.status, {
        date: req.body.deliveryDate || req.body.dispatchDate || null,
        time: req.body.deliveryTime || req.body.dispatchTime || null
      });
      if (!changed) row.status = req.body.status;
    }

    ensureDeliveredFields(row, req.body.deliveryDate || null, req.body.deliveryTime || null);

    await row.save();
    return res.json(toResponse(row));
  } catch (error) {
    return res.status(500).json({ message: "Failed to update courier.", error: error.message });
  }
});

router.post("/bulk/dispatch", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const { ids, dispatchDate, dispatchTime, trackingNo, remarks } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "ids must be a non-empty array." });
    }

    const rows = await OutwardCourier.findAll({ where: { id: ids } });
    if (rows.length !== ids.length) {
      return res.status(404).json({ message: "One or more couriers were not found." });
    }
    if (rows.some((row) => !canAccessOutward(req, row))) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    for (const row of rows) {
      if (dispatchDate !== undefined && dispatchDate !== null && dispatchDate !== "") row.dispatchDate = dispatchDate;
      if (dispatchTime !== undefined && dispatchTime !== null && dispatchTime !== "") row.dispatchTime = dispatchTime;
      if (trackingNo !== undefined && trackingNo !== null && trackingNo !== "") row.trackingNo = trackingNo;
      if (remarks !== undefined && remarks !== null) row.remarks = remarks;
      await row.save();
    }

    return res.json({ message: "Dispatch bulk update applied." });
  } catch (error) {
    return res.status(500).json({ message: "Bulk dispatch update failed.", error: error.message });
  }
});

router.post("/bulk/status", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const { ids, status, deliveryDate, deliveryTime, remarks } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "ids must be a non-empty array." });
    }

    const validStatuses = await getValidStatuses();
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const rows = await OutwardCourier.findAll({ where: { id: ids } });
    if (rows.length !== ids.length) {
      return res.status(404).json({ message: "One or more couriers were not found." });
    }
    if (rows.some((row) => !canAccessOutward(req, row))) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    for (const row of rows) {
      await applyStatusChangeWithTimeline(row, status, {
        date: deliveryDate || null,
        time: deliveryTime || null
      });
      if (deliveryDate !== undefined && deliveryDate !== null && deliveryDate !== "") row.deliveryDate = deliveryDate;
      if (deliveryTime !== undefined && deliveryTime !== null && deliveryTime !== "") row.deliveryTime = deliveryTime;
      if (remarks !== undefined && remarks !== null) row.remarks = remarks;
      ensureDeliveredFields(row, deliveryDate || null, deliveryTime || null);
      await row.save();
    }

    return res.json({ message: "Status bulk update applied." });
  } catch (error) {
    return res.status(500).json({ message: "Bulk status update failed.", error: error.message });
  }
});

router.post("/:id/fetch-status", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const row = await OutwardCourier.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Courier not found." });
    if (!canAccessOutward(req, row)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    let fetchedStatus = row.status;
    if (row.status === "sent") fetchedStatus = "in-transit";
    else if (row.status === "in-transit") fetchedStatus = "delivered";

    const changed = await applyStatusChangeWithTimeline(row, fetchedStatus, {
      date: row.deliveryDate || null,
      time: row.deliveryTime || null
    });

    if (fetchedStatus === "delivered") {
      ensureDeliveredFields(row);
    }

    if (changed) await row.save();

    return res.json({
      changed,
      message: changed ? `Status updated to ${fetchedStatus}.` : "No status change from courier provider.",
      courier: toResponse(row)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch courier status.", error: error.message });
  }
});

export default router;
