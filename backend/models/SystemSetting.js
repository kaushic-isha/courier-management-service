import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const SystemSetting = sequelize.define(
  "SystemSetting",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    value: {
      type: DataTypes.TEXT("long"),
      allowNull: false
    }
  },
  {
    tableName: "system_settings",
    timestamps: true
  }
);

export default SystemSetting;
