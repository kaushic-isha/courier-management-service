import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Department = sequelize.define(
  "Department",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Ashram"
    }
  },
  {
    tableName: "departments",
    timestamps: true
  }
);

export default Department;
