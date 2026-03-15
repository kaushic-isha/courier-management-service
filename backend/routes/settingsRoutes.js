import express from "express";
import SystemSetting from "../models/SystemSetting.js";
import Department from "../models/Department.js";
import requireRole from "../middleware/requireRole.js";

const router = express.Router();
router.use(requireRole("Admin"));

const EDITABLE_KEYS = ["auth.roles", "outward.validStatuses"];
const LOCATIONS = ["Ashram", "Sadivayal Office"];

function parseSettingValue(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

router.get("/", async (_req, res) => {
  try {
    const rows = await SystemSetting.findAll({ where: { key: EDITABLE_KEYS } });
    const data = EDITABLE_KEYS.map((key) => {
      const row = rows.find((r) => r.key === key);
      return {
        key,
        value: row ? parseSettingValue(row.value) : []
      };
    });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch settings.", error: error.message });
  }
});

router.patch("/:key", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!EDITABLE_KEYS.includes(key)) {
      return res.status(400).json({ message: "This setting key is not editable." });
    }

    if (!Array.isArray(req.body.value)) {
      return res.status(400).json({ message: "value must be an array." });
    }

    const sanitized = req.body.value
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    if (!sanitized.length) {
      return res.status(400).json({ message: "At least one value is required." });
    }

    const [row] = await SystemSetting.findOrCreate({
      where: { key },
      defaults: { value: JSON.stringify(sanitized) }
    });

    row.value = JSON.stringify(sanitized);
    await row.save();

    return res.json({ key, value: sanitized });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update setting.", error: error.message });
  }
});

router.get("/departments", async (_req, res) => {
  try {
    const rows = await Department.findAll({ order: [["location", "ASC"], ["name", "ASC"]] });
    const grouped = LOCATIONS.reduce((acc, location) => ({ ...acc, [location]: [] }), {});
    rows.forEach((row) => {
      const key = row.location || "Ashram";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ id: row.id, name: row.name, location: key });
    });
    return res.json(grouped);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch departments.", error: error.message });
  }
});

router.post("/departments", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const location = String(req.body.location || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Department name is required." });
    }
    if (!LOCATIONS.includes(location)) {
      return res.status(400).json({ message: "A valid origin is required." });
    }
    const existing = await Department.findOne({ where: { name, location } });
    if (existing) {
      return res.status(409).json({ message: "Department already exists for this origin." });
    }
    const row = await Department.create({ name, location });
    return res.status(201).json({ id: row.id, name: row.name, location: row.location });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create department.", error: error.message });
  }
});

router.patch("/departments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || "").trim();

    if (!id) {
      return res.status(400).json({ message: "A valid department id is required." });
    }
    if (!name) {
      return res.status(400).json({ message: "Department name is required." });
    }

    const row = await Department.findByPk(id);
    if (!row) {
      return res.status(404).json({ message: "Department not found." });
    }

    const existing = await Department.findOne({ where: { name, location: row.location } });
    if (existing && existing.id !== row.id) {
      return res.status(409).json({ message: "Department already exists for this origin." });
    }

    row.name = name;
    await row.save();

    return res.json({ id: row.id, name: row.name, location: row.location });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update department.", error: error.message });
  }
});

export default router;
