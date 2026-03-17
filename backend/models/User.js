import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "role_id"
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    approvalStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "approved",
      field: "approval_status"
    },
    canApproveUsers: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "can_approve_users"
    }
  },
  {
    tableName: "users",
    timestamps: true
  }
);

export default User;
