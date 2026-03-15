import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Role = sequelize.define(
  "Role",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    accessLevel: {
      type: DataTypes.ENUM("full_system", "filtered", "limited"),
      allowNull: false,
      defaultValue: "limited"
    },
    isSystemDefined: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    departmentFilters: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: "roles",
    timestamps: true
  }
);

export default Role;
