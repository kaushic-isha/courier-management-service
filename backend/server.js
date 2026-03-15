import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { DataTypes } from "sequelize";
import sequelize from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import inwardRoutes from "./routes/inwardRoutes.js";
import outwardRoutes from "./routes/outwardRoutes.js";
import SystemSetting from "./models/SystemSetting.js";
import userRoutes from "./routes/userRoutes.js";
import verifyJwt from "./middleware/verifyJwt.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import Role from "./models/Role.js";
import Department from "./models/Department.js";
import UserRole from "./models/UserRole.js";
import User from "./models/User.js";
import {
  ensureInitialDepartmentLocationAssignments,
  ensureRoleAndDepartmentSeeds,
  setUserAccessMapping
} from "./services/userAccessService.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/inward", verifyJwt, inwardRoutes);
app.use("/api/outward", verifyJwt, outwardRoutes);
app.use("/api/users", verifyJwt, userRoutes);
app.use("/api/settings", verifyJwt, settingsRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const queryInterface = sequelize.getQueryInterface();

async function describeTableSafe(tableName) {
  try {
    return await queryInterface.describeTable(tableName);
  } catch (_error) {
    return null;
  }
}

async function hasColumn(tableName, columnName) {
  const table = await describeTableSafe(tableName);
  return Boolean(table && table[columnName]);
}

async function startServer() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    await ensureUserIsActiveColumn();
    await ensureUserLocationColumn();
    await ensureLegacyUserRoleDepartmentColumnsNullable();
    await ensureOutwardStatusEnum();
    await ensureOutwardOriginColumn();
    await ensureOutwardTimelineColumn();
    await ensureInwardDeliveredToColumn();
    await ensureDepartmentLocationColumn();
    await ensureDepartmentNameNotGloballyUnique();
    await removePrivilegeTables();
    await ensureSystemSettings();
    await ensureAccessControlTables();
    await ensureRoleAndDepartmentSeeds();
    await ensureInitialDepartmentLocationAssignments();
    await migrateLegacyUserAccess();
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

async function removePrivilegeTables() {
  await queryInterface.dropTable("role_privileges").catch(() => {});
  await queryInterface.dropTable("privileges").catch(() => {});
}

async function ensureUserIsActiveColumn() {
  if (!(await hasColumn("users", "isActive"))) {
    await queryInterface.addColumn("users", "isActive", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  }
}

async function ensureUserLocationColumn() {
  if (!(await hasColumn("users", "location"))) {
    await queryInterface.addColumn("users", "location", {
      type: DataTypes.STRING,
      allowNull: true
    });
  }
}

async function ensureLegacyUserRoleDepartmentColumnsNullable() {
  if (await hasColumn("users", "role")) {
    await queryInterface.changeColumn("users", "role", {
      type: DataTypes.STRING(100),
      allowNull: true
    }).catch(() => {});
  }
  if (await hasColumn("users", "department")) {
    await queryInterface.changeColumn("users", "department", {
      type: DataTypes.STRING,
      allowNull: true
    }).catch(() => {});
  }
}

async function ensureOutwardStatusEnum() {
  if (await hasColumn("outward_couriers", "status")) {
    await queryInterface.changeColumn("outward_couriers", "status", {
      type: DataTypes.ENUM("requested", "sent", "in-transit", "delivered", "cancelled", "returned"),
      allowNull: false,
      defaultValue: "sent"
    }).catch(() => {});
  }
}

async function ensureOutwardOriginColumn() {
  if (!(await hasColumn("outward_couriers", "origin"))) {
    await queryInterface.addColumn("outward_couriers", "origin", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Sadivayal Office"
    });
  }
  await sequelize.query("UPDATE outward_couriers SET origin = 'Sadivayal Office' WHERE origin IS NULL OR origin = ''").catch(() => {});
}

async function ensureOutwardTimelineColumn() {
  if (!(await hasColumn("outward_couriers", "statusTimeline"))) {
    await queryInterface.addColumn("outward_couriers", "statusTimeline", {
      type: DataTypes.TEXT("long"),
      allowNull: true
    });
  }
}

async function ensureInwardDeliveredToColumn() {
  if (!(await hasColumn("inward_couriers", "deliveredTo"))) {
    await queryInterface.addColumn("inward_couriers", "deliveredTo", {
      type: DataTypes.STRING,
      allowNull: true
    });
  }
}

async function ensureDepartmentLocationColumn() {
  if (!(await hasColumn("departments", "location"))) {
    await queryInterface.addColumn("departments", "location", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Ashram"
    });
  }
}

async function ensureDepartmentNameNotGloballyUnique() {
  const indexes = await queryInterface.showIndex("departments").catch(() => []);
  for (const index of indexes) {
    const isNameOnlyUnique =
      index.unique &&
      index.fields?.length === 1 &&
      index.fields[0]?.attribute === "name";
    if (isNameOnlyUnique && index.name) {
      await queryInterface.removeIndex("departments", index.name).catch(() => {});
    }
  }
}

async function ensureSystemSettings() {
  const defaults = [
    {
      key: "auth.roles",
      value: JSON.stringify(["Department User", "Admin", "Courier Office Staff"])
    },
    {
      key: "auth.departments",
      value: JSON.stringify([
        "Ashram Programs",
        "Ashram Admin",
        "VCD",
        "IT",
        "E Media",
        "Akshaya",
        "IPC",
        "IPC Backoffice",
        "OCO",
        "Sadhanapada"
      ])
    },
    {
      key: "inward.editableFields",
      value: JSON.stringify([
        "docket",
        "department",
        "source",
        "deliveredTo",
        "vendor",
        "trackingNo",
        "receiverName",
        "receiverContact",
        "senderName",
        "senderAddress",
        "senderContact",
        "type",
        "parcels",
        "weight",
        "status",
        "receivedDate",
        "receivedTime",
        "collectedDate",
        "collectedTime",
        "remarks",
        "dateOfEntry"
      ])
    },
    {
      key: "outward.editableFields",
      value: JSON.stringify([
        "docket",
        "department",
        "origin",
        "vendor",
        "trackingNo",
        "senderName",
        "senderContact",
        "senderDept",
        "receiverName",
        "receiverAddress",
        "receiverContact",
        "type",
        "parcels",
        "weight",
        "estCost",
        "actualCost",
        "status",
        "dispatchDate",
        "dispatchTime",
        "deliveryDate",
        "deliveryTime",
        "remarks",
        "statusTimeline",
        "dateOfEntry"
      ])
    },
    {
      key: "outward.validStatuses",
      value: JSON.stringify(["requested", "sent", "in-transit", "delivered", "cancelled"])
    },
    {
      key: "outward.statusMeta",
      value: JSON.stringify({
        requested: { title: "Requested", note: "Outward request submitted by department" },
        sent: { title: "Dispatched", note: "Package picked up from sender" },
        "in-transit": { title: "In Transit", note: "Package is in transit" },
        delivered: { title: "Delivered", note: "Package delivered" },
        cancelled: { title: "Cancelled", note: "Shipment cancelled" }
      })
    }
  ];

  for (const item of defaults) {
    await SystemSetting.findOrCreate({
      where: { key: item.key },
      defaults: { value: item.value }
    });
  }
}

async function ensureAccessControlTables() {
  await Role.sync();
  await Department.sync();
  await UserRole.sync();

  const indexes = await queryInterface.showIndex("users_to_roles").catch(() => []);
  const hasUserIdUniqueIndex = indexes.some((index) =>
    index.unique && index.fields?.length === 1 && index.fields[0]?.attribute === "userId"
  );
  if (!hasUserIdUniqueIndex) {
    await queryInterface.addIndex("users_to_roles", ["userId"], {
      unique: true,
      name: "uq_users_to_roles_user_id"
    }).catch(() => {});
  }
}

async function migrateLegacyUserAccess() {
  const hasRoleColumn = await hasColumn("users", "role");
  const hasDepartmentColumn = await hasColumn("users", "department");

  if (!hasRoleColumn) {
    return;
  }

  const attributes = ["id", "role"];
  if (hasDepartmentColumn) attributes.push("department");

  const users = await User.findAll({ attributes });
  for (const user of users) {
    if (!user.role) continue;
    await setUserAccessMapping(user.id, user.role, user.department || null, user.location || null);
  }
}

startServer();
