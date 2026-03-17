import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signJwt } from "../middleware/verifyJwt.js";
import {
  findScopeApprover,
  getConfiguredDepartments,
  getConfiguredDepartmentsByLocation,
  getConfiguredRoles,
  getUserAccessByUserId,
  setUserAccessMapping
} from "../services/userAccessService.js";

const router = express.Router();
const LOCATIONS = ["Sadivayal Office", "Ashram"];

router.get("/options", async (_req, res) => {
  try {
    const roles = await getConfiguredRoles();
    const departmentsByLocation = await getConfiguredDepartmentsByLocation();
    const departments = Object.values(departmentsByLocation).flat();
    return res.json({ roles, departments, departmentsByLocation, locations: LOCATIONS });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load auth options.", error: error.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { role, department, location, email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const ROLES = await getConfiguredRoles();
    const DEPARTMENTS = await getConfiguredDepartments(location || null);

    if (!role || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Role, email, and password are required." });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected." });
    }

    let finalDepartment = null;
    if (role === "Department User") {
      if (!department || !DEPARTMENTS.includes(department)) {
        return res.status(400).json({ message: "Please choose a valid department." });
      }
      finalDepartment = department;
    }
    if (["Department User", "Courier Office Staff"].includes(role)) {
      if (!location || !LOCATIONS.includes(location)) {
        return res.status(400).json({ message: "Please choose a valid location." });
      }
    }

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
      attributes: ["id"]
    });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const existingApprover = await findScopeApprover(role, finalDepartment, location || null);
    const isFirstScopeUser = !existingApprover;
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      location: ["Department User", "Courier Office Staff"].includes(role) ? location : null,
      isActive: isFirstScopeUser,
      approvalStatus: isFirstScopeUser ? "approved" : "pending",
      canApproveUsers: isFirstScopeUser
    });
    await setUserAccessMapping(user.id, role, finalDepartment, user.location);

    return res.status(201).json({
      message: isFirstScopeUser
        ? "User registered successfully. You are the approver for this role and location."
        : "Registration submitted. Wait for approval from the first approved user in this role and location.",
      approvalStatus: isFirstScopeUser ? "approved" : "pending",
      canApproveUsers: isFirstScopeUser
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "User already exists." });
    }

    return res.status(500).json({ message: "Registration failed.", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { role, department, location, email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const ROLES = await getConfiguredRoles();
    const DEPARTMENTS = await getConfiguredDepartments(location || null);

    if (!role || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Role, email, and password are required." });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected." });
    }

    if (role === "Department User") {
      if (!department || !DEPARTMENTS.includes(department)) {
        return res.status(400).json({ message: "Please choose a valid department." });
      }
    }
    if (["Department User", "Courier Office Staff"].includes(role)) {
      if (!location || !LOCATIONS.includes(location)) {
        return res.status(400).json({ message: "Please choose a valid location." });
      }
    }

    const user = await User.findOne({
      where: { email: normalizedEmail },
      attributes: [
        "id",
        "email",
        "passwordHash",
        "isActive",
        "location",
        "approvalStatus",
        "canApproveUsers"
      ]
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.isActive) {
      if (user.approvalStatus === "pending") {
        return res.status(403).json({ message: "Your registration is pending approval." });
      }
      if (user.approvalStatus === "rejected") {
        return res.status(403).json({ message: "Your registration was rejected." });
      }
      return res.status(403).json({ message: "Your account is temporarily disabled. Contact admin." });
    }

    if (role !== "Admin" && !user.location) {
      return res.status(403).json({ message: "Your account has no assigned location. Contact admin." });
    }

    const access = await getUserAccessByUserId(user.id);
    if (!access?.role || access.role !== role) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (role === "Department User" && access.department !== department) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    if (["Department User", "Courier Office Staff"].includes(role) && user.location !== location) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Guard legacy or partially created accounts from throwing in bcrypt.compare.
    if (!user.passwordHash || typeof user.passwordHash !== "string") {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    return res.status(200).json({
      message: "Login successful.",
      token: signJwt({
        id: user.id,
        email: user.email,
        role: access.role,
        department: access.department,
        location: role === "Admin" ? null : user.location || null,
        roleId: access.roleId || null,
        canApproveUsers: Boolean(user.canApproveUsers),
        approvalStatus: user.approvalStatus || "approved"
      }),
      user: {
        id: user.id,
        email: user.email,
        role: access.role,
        department: access.department,
        location: role === "Admin" ? null : user.location || null,
        roleId: access.roleId || null,
        canApproveUsers: Boolean(user.canApproveUsers),
        approvalStatus: user.approvalStatus || "approved"
      }
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Login failed.", error: error.message });
  }
});

export default router;
