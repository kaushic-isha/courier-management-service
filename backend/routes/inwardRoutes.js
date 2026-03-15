import express from "express";
import InwardCourier from "../models/InwardCourier.js";
import SystemSetting from "../models/SystemSetting.js";

const router = express.Router();

function isAdminOrStaff(req) {
  return ["Admin", "Courier Office Staff"].includes(req.auth?.role);
}

function isDepartmentUser(req) {
  return req.auth?.role === "Department User";
}

function canAccessInward(req, row) {
  if (req.auth?.role === "Admin") return true;
  if (isDepartmentUser(req)) {
    if (row.department !== req.auth.department) return false;
    if (req.auth.location && row.deliveredTo !== req.auth.location) return false;
    return true;
  }
  if (req.auth?.role === "Courier Office Staff") {
    if (req.auth.location && row.deliveredTo !== req.auth.location) return false;
    return true;
  }
  return false;
}

function getDefaultEditableFields() {
  const blocked = new Set(["id", "createdAt", "updatedAt"]);
  return Object.keys(InwardCourier.rawAttributes).filter((k) => !blocked.has(k));
}

async function getEditableFields() {
  const defaultFields = getDefaultEditableFields();
  const row = await SystemSetting.findOne({ where: { key: "inward.editableFields" } });
  if (!row?.value) return defaultFields;
  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return defaultFields;
    const allowedSet = new Set(defaultFields);
    const editableFields = parsed.filter((field) => allowedSet.has(field));
    if (allowedSet.has("deliveredTo") && !editableFields.includes("deliveredTo")) {
      editableFields.push("deliveredTo");
    }
    return editableFields;
  } catch (_error) {
    return defaultFields;
  }
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

function extractCollectorDetails(rowData) {
  const remarks = String(rowData.remarks || "");
  const collectorNameMatch = remarks.match(/(?:collected\s*by(?:\s*name)?|collector\s*name)\s*:\s*([^|\n,]+)/i);
  const collectorContactMatch = remarks.match(
    /(?:collector\s*contact(?:\s*number)?|collected\s*by\s*contact(?:\s*number)?)\s*:\s*([^|\n,]+)/i
  );

  const collectorName =
    rowData.collectedByName ||
    (collectorNameMatch?.[1] ? collectorNameMatch[1].trim() : "") ||
    ((rowData.collectedDate || rowData.collectedTime) ? rowData.receiverName || "" : "");
  const collectorContact =
    rowData.collectedByContact ||
    (collectorContactMatch?.[1] ? collectorContactMatch[1].trim() : "") ||
    ((rowData.collectedDate || rowData.collectedTime) ? rowData.receiverContact || "" : "");

  return { collectorName, collectorContact };
}

function hasCollectionDetails(data) {
  return Boolean(
    String(data?.collectedDate || "").trim() ||
    String(data?.collectedTime || "").trim()
  );
}

function toResponse(row) {
  const data = row.toJSON();
  return {
    ...data,
    ...extractCollectorDetails(data),
    lastEdited: formatLastEdited(data.updatedAt)
  };
}

router.get("/", async (_req, res) => {
  try {
    if (!_req.auth?.role) return res.status(403).json({ message: "Access denied." });
    const where = {};
    if (isDepartmentUser(_req)) {
      where.department = _req.auth.department;
      if (_req.auth.location) where.deliveredTo = _req.auth.location;
    } else if (_req.auth.role === "Courier Office Staff" && _req.auth.location) {
      where.deliveredTo = _req.auth.location;
    }

    const rows = await InwardCourier.findAll({
      where,
      order: [["id", "ASC"]]
    });
    return res.json(rows.map(toResponse));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch inward couriers.", error: error.message });
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
      source: (req.body.source || "").trim(),
      deliveredTo: (req.body.deliveredTo || "").trim(),
      vendor: (req.body.vendor || "").trim(),
      trackingNo: (req.body.trackingNo || "").trim(),
      receiverName: (req.body.receiverName || "").trim(),
      receiverContact: (req.body.receiverContact || "").trim(),
      senderName: (req.body.senderName || "").trim(),
      senderAddress: (req.body.senderAddress || "").trim(),
      senderContact: (req.body.senderContact || "").trim(),
      type: (req.body.type || "").trim(),
      parcels: Number(req.body.parcels) || 1,
      weight: req.body.weight ? String(req.body.weight) : "0",
      status: req.body.status || "received",
      receivedDate: req.body.receivedDate || null,
      receivedTime: req.body.receivedTime || null,
      collectedDate: req.body.collectedDate || null,
      collectedTime: req.body.collectedTime || null,
      remarks: req.body.remarks || "",
      dateOfEntry: req.body.dateOfEntry || null
    };

    if (hasCollectionDetails(payload)) {
      payload.status = "handed-over";
    }

    if (
      !payload.docket ||
      !payload.department ||
      !payload.source ||
      !payload.deliveredTo ||
      !payload.vendor ||
      !payload.receiverName ||
      !payload.receiverContact ||
      !payload.senderName ||
      !payload.type ||
      !payload.dateOfEntry
    ) {
      return res.status(400).json({ message: "Missing required inward courier fields." });
    }

    if (!["received", "handed-over", "discarded"].includes(payload.status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    if (req.auth?.role === "Courier Office Staff" && req.auth.location && payload.deliveredTo !== req.auth.location) {
      return res.status(403).json({ message: "You can only create inward couriers for your assigned location." });
    }

    const row = await InwardCourier.create(payload);
    return res.status(201).json(toResponse(row));
  } catch (error) {
    return res.status(500).json({ message: "Failed to create inward courier.", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await InwardCourier.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ message: "Courier not found." });
    }
    if (!canAccessInward(req, row)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    return res.json(toResponse(row));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch inward courier.", error: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const row = await InwardCourier.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ message: "Courier not found." });
    }
    if (!canAccessInward(req, row)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const editableFields = await getEditableFields();
    for (const key of editableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        row[key] = req.body[key];
      }
    }

    if (hasCollectionDetails(row)) {
      row.status = "handed-over";
    }

    if (req.auth?.role === "Courier Office Staff" && req.auth.location && row.deliveredTo !== req.auth.location) {
      return res.status(403).json({ message: "You can only update inward couriers for your assigned location." });
    }

    await row.save();
    return res.json(toResponse(row));
  } catch (error) {
    return res.status(500).json({ message: "Failed to update courier.", error: error.message });
  }
});

router.post("/bulk/collection", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const { ids, collectedDate, collectedTime, collectedBy, remarks } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "ids must be a non-empty array." });
    }

    const rows = await InwardCourier.findAll({ where: { id: ids } });
    if (rows.length !== ids.length) {
      return res.status(404).json({ message: "One or more couriers were not found." });
    }
    if (rows.some((row) => !canAccessInward(req, row))) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    for (const row of rows) {
      if (collectedDate) row.collectedDate = collectedDate;
      if (collectedTime) row.collectedTime = collectedTime;
      if (remarks !== undefined && remarks !== null && remarks !== "") row.remarks = remarks;
      else if (collectedBy) row.remarks = `Collected by: ${collectedBy}`;
      if (hasCollectionDetails(row)) row.status = "handed-over";
      await row.save();
    }

    return res.json({ message: "Collection bulk update applied." });
  } catch (error) {
    return res.status(500).json({ message: "Bulk collection update failed.", error: error.message });
  }
});

router.post("/bulk/parcel", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const { ids, parcels, weight, remarks } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "ids must be a non-empty array." });
    }

    const rows = await InwardCourier.findAll({ where: { id: ids } });
    if (rows.length !== ids.length) {
      return res.status(404).json({ message: "One or more couriers were not found." });
    }
    if (rows.some((row) => !canAccessInward(req, row))) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    for (const row of rows) {
      if (parcels !== undefined && parcels !== null && parcels !== "") row.parcels = Number(parcels);
      if (weight !== undefined && weight !== null && weight !== "") row.weight = weight;
      if (remarks !== undefined && remarks !== null && remarks !== "") row.remarks = remarks;
      await row.save();
    }

    return res.json({ message: "Parcel bulk update applied." });
  } catch (error) {
    return res.status(500).json({ message: "Bulk parcel update failed.", error: error.message });
  }
});

router.post("/bulk/status", async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "ids must be a non-empty array." });
    }
    if (!status) {
      return res.status(400).json({ message: "status is required." });
    }

    const rows = await InwardCourier.findAll({ where: { id: ids } });
    if (rows.length !== ids.length) {
      return res.status(404).json({ message: "One or more couriers were not found." });
    }
    if (rows.some((row) => !canAccessInward(req, row))) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    for (const row of rows) {
      row.status = status;
      await row.save();
    }

    return res.json({ message: "Status bulk update applied." });
  } catch (error) {
    return res.status(500).json({ message: "Bulk status update failed.", error: error.message });
  }
});

export default router;
