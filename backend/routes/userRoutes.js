import express from "express";
import { Op } from "sequelize";
import User from "../models/User.js";
import requireRole from "../middleware/requireRole.js";
import Role from "../models/Role.js";
import {
  getConfiguredDepartments,
  getConfiguredRoles,
  getUserAccessByUserId,
  isApproverForUser,
  listPendingUsersForApprover,
  listUsersWithAccess,
  setUserAccessMapping
} from "../services/userAccessService.js";

const router = express.Router();
const LOCATIONS = ["Sadivayal Office", "Ashram"];

router.patch("/:id/role", requireRole("Admin"), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const roleId = Number(req.body.roleId);
    if (!roleId) return res.status(400).json({ message: "roleId is required." });
    const role = await Role.findByPk(roleId);
    if (!role) return res.status(400).json({ message: "Invalid roleId." });

    user.roleId = roleId;
    await user.save();
    try {
      await setUserAccessMapping(user.id, role.name, req.body.department || null, req.body.location || user.location || null);
    } catch (_error) {
      // Custom RBAC role may not be part of legacy role/dept mapping.
    }
    return res.json({ message: "User role updated.", userId: user.id, roleId });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update user role.", error: error.message });
  }
});

router.get("/", requireRole("Admin"), async (_req, res) => {
  try {
    const rows = await listUsersWithAccess();
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users.", error: error.message });
  }
});

router.get("/pending", async (req, res) => {
  try {
    const authId = req.auth?.id;
    if (!authId) return res.status(403).json({ message: "Access denied." });

    // Admin can see all pending registrations.
    if (req.auth.role === "Admin") {
      const allUsers = await listUsersWithAccess();
      return res.json(allUsers.filter((u) => u.approvalStatus === "pending"));
    }

    // Other approvers can only see pending users in their own approval scope.
    if (!req.auth.canApproveUsers || req.auth.approvalStatus !== "approved") {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    const pending = await listPendingUsersForApprover(authId);
    return res.json(pending);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch pending users.", error: error.message });
  }
});

router.post("/:id/approval", async (req, res) => {
  try {
    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) return res.status(404).json({ message: "User not found." });

    const approve = Boolean(req.body.approve);

    const isAdmin = req.auth?.role === "Admin";
    const isApprover = isAdmin || (await isApproverForUser(req.auth?.id, targetUser.id));
    if (!isApprover) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    targetUser.isActive = approve;
    targetUser.approvalStatus = approve ? "approved" : "rejected";
    await targetUser.save();

    return res.json({
      id: targetUser.id,
      email: targetUser.email,
      isActive: targetUser.isActive,
      approvalStatus: targetUser.approvalStatus
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update approval status.", error: error.message });
  }
});

router.patch("/:id", requireRole("Admin"), async (req, res) => {
  try {
    const row = await User.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "User not found." });

    if (Object.prototype.hasOwnProperty.call(req.body, "email")) {
      const email = String(req.body.email || "").trim();
      if (!email) return res.status(400).json({ message: "Email is required." });
      const existing = await User.findOne({ where: { email, id: { [Op.ne]: row.id } } });
      if (existing) return res.status(409).json({ message: "Email is already in use." });
      row.email = email;
    }

    let nextRole = null;
    let nextDepartment = null;
    let nextLocation = null;
    const currentAccess = await getUserAccessByUserId(row.id);

    if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
      nextRole = String(req.body.role || "").trim();
      const ROLES = await getConfiguredRoles();
      if (!ROLES.includes(nextRole)) return res.status(400).json({ message: "Invalid role." });
    } else {
      nextRole = currentAccess?.role || null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "department")) {
      nextDepartment = req.body.department ? String(req.body.department).trim() : null;
    } else {
      nextDepartment = currentAccess?.department || null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "location")) {
      nextLocation = req.body.location ? String(req.body.location).trim() : null;
    } else {
      nextLocation = row.location || null;
    }

    if (nextRole === "Department User") {
      const DEPARTMENTS = await getConfiguredDepartments(nextLocation || null);
      if (!nextDepartment || !DEPARTMENTS.includes(nextDepartment)) {
        return res.status(400).json({ message: "Department is required for Department User." });
      }
    } else {
      nextDepartment = null;
    }

    if (nextRole !== "Admin") {
      if (!nextLocation || !LOCATIONS.includes(nextLocation)) {
        return res.status(400).json({ message: "Location is required for non-admin users." });
      }
    } else {
      nextLocation = null;
    }

    row.location = nextLocation;

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      row.isActive = Boolean(req.body.isActive);
    }

    await row.save();
    if (nextRole) {
      await setUserAccessMapping(row.id, nextRole, nextDepartment, row.location || null);
    }
    const updatedAccess = await getUserAccessByUserId(row.id);
    return res.json({
      id: row.id,
      email: row.email,
      role: updatedAccess?.role || null,
      department: updatedAccess?.department || null,
      location: row.location || null,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update user.", error: error.message });
  }
});

router.delete("/:id", requireRole("Admin"), async (req, res) => {
  try {
    const row = await User.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "User not found." });
    await row.destroy();
    return res.json({ message: "User deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete user.", error: error.message });
  }
});

export default router;
