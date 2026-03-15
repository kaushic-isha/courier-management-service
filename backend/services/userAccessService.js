import { Op } from "sequelize";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Department from "../models/Department.js";
import UserRole from "../models/UserRole.js";
import SystemSetting from "../models/SystemSetting.js";

const DEFAULT_ROLES = ["Department User", "Admin", "Courier Office Staff"];
const DEFAULT_DEPARTMENTS = [
  { name: "Ashram Programs", location: "Ashram" },
  { name: "Ashram Admin", location: "Ashram" },
  { name: "VCD", location: "Ashram" },
  { name: "Akshaya", location: "Ashram" },
  { name: "Sadhanapada", location: "Ashram" },
  { name: "E Media", location: "Ashram" },
  { name: "IT", location: "Sadivayal Office" },
  { name: "IPC", location: "Sadivayal Office" },
  { name: "IPC Backoffice", location: "Sadivayal Office" },
  { name: "OCO", location: "Ashram" }
];
const DEFAULT_SADIVAYAL_DEPARTMENTS = DEFAULT_DEPARTMENTS
  .filter((department) => department.location === "Sadivayal Office")
  .map((department) => department.name);

async function getSettingJson(key, fallback = []) {
  const row = await SystemSetting.findOne({ where: { key } });
  if (!row?.value) return fallback;
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

export async function getConfiguredRoles() {
  const roles = await getSettingJson("auth.roles", DEFAULT_ROLES);
  return roles.length ? roles : DEFAULT_ROLES;
}

export async function getConfiguredDepartments(location = null) {
  const where = location ? { location } : undefined;
  const rows = await Department.findAll({ where, order: [["name", "ASC"]] });
  return rows.map((row) => row.name);
}

export async function getConfiguredDepartmentsByLocation() {
  const rows = await Department.findAll({ order: [["location", "ASC"], ["name", "ASC"]] });
  return rows.reduce((acc, row) => {
    const key = row.location || "Unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row.name);
    return acc;
  }, {});
}

export async function ensureRoleAndDepartmentSeeds() {
  const roles = await getConfiguredRoles();

  for (const roleName of roles) {
    await Role.findOrCreate({ where: { name: roleName } });
  }

  for (const department of DEFAULT_DEPARTMENTS) {
    const [row] = await Department.findOrCreate({
      where: { name: department.name, location: department.location },
      defaults: department
    });
    if (!row.location) {
      row.location = department.location;
      await row.save();
    }
  }
}

export async function ensureInitialDepartmentLocationAssignments() {
  const sadivayalCount = await Department.count({ where: { location: "Sadivayal Office" } });
  if (sadivayalCount > 0) return;

  await Department.update(
    { location: "Sadivayal Office" },
    { where: { name: { [Op.in]: DEFAULT_SADIVAYAL_DEPARTMENTS } } }
  );
}

export async function setUserAccessMapping(userId, roleName, departmentName = null, userLocation = null) {
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) {
    throw new Error(`Role not found: ${roleName}`);
  }

  let departmentId = null;
  if (roleName === "Department User") {
    if (!departmentName) {
      throw new Error("Department is required for Department User.");
    }
    if (!userLocation) {
      throw new Error("Location is required for Department User.");
    }
    const department = await Department.findOne({ where: { name: departmentName, location: userLocation } });
    if (!department) {
      throw new Error(`Department not found for ${userLocation}: ${departmentName}`);
    }
    departmentId = department.id;
  }

  const existing = await UserRole.findOne({ where: { userId } });
  if (existing) {
    existing.roleId = role.id;
    existing.departmentId = departmentId;
    await existing.save();
    await User.update({ roleId: role.id }, { where: { id: userId } });
    return existing;
  }

  const created = await UserRole.create({ userId, roleId: role.id, departmentId });
  await User.update({ roleId: role.id }, { where: { id: userId } });
  return created;
}

export async function getUserAccessByUserId(userId) {
  const mapping = await UserRole.findOne({ where: { userId } });
  if (!mapping) return null;

  const [role, department] = await Promise.all([
    Role.findByPk(mapping.roleId),
    mapping.departmentId ? Department.findByPk(mapping.departmentId) : null
  ]);

  if (!role) return null;

  return {
    role: role.name,
    department: department?.name || null,
    roleId: role.id,
    departmentId: department?.id || null
  };
}

export async function listUsersWithAccess() {
  const users = await User.findAll({
    attributes: ["id", "email", "location", "isActive", "createdAt", "updatedAt"],
    order: [["id", "ASC"]]
  });

  const userIds = users.map((u) => u.id);
  if (!userIds.length) return [];

  const mappings = await UserRole.findAll({ where: { userId: { [Op.in]: userIds } } });
  const roleIds = [...new Set(mappings.map((m) => m.roleId))];
  const departmentIds = [...new Set(mappings.map((m) => m.departmentId).filter(Boolean))];

  const [roles, departments] = await Promise.all([
    roleIds.length ? Role.findAll({ where: { id: { [Op.in]: roleIds } } }) : [],
    departmentIds.length ? Department.findAll({ where: { id: { [Op.in]: departmentIds } } }) : []
  ]);

  const roleMap = new Map(roles.map((r) => [r.id, r.name]));
  const departmentMap = new Map(departments.map((d) => [d.id, d.name]));
  const mappingMap = new Map(mappings.map((m) => [m.userId, m]));

  return users.map((user) => {
    const mapping = mappingMap.get(user.id);
    return {
      id: user.id,
      email: user.email,
      role: mapping ? roleMap.get(mapping.roleId) || null : null,
      department: mapping ? departmentMap.get(mapping.departmentId) || null : null,
      location: user.location || null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  });
}
