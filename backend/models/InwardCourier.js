import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const InwardCourier = sequelize.define(
  "InwardCourier",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    docket: {
      type: DataTypes.STRING,
      allowNull: false
    },
    department: {
      type: DataTypes.STRING,
      allowNull: false
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false
    },
    deliveredTo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vendor: {
      type: DataTypes.STRING,
      allowNull: false
    },
    trackingNo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    receiverName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    receiverContact: {
      type: DataTypes.STRING,
      allowNull: false
    },
    senderName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    senderAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    senderContact: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    parcels: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    weight: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "0"
    },
    status: {
      type: DataTypes.ENUM("received", "handed-over", "discarded"),
      allowNull: false,
      defaultValue: "received"
    },
    receivedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    receivedTime: {
      type: DataTypes.STRING,
      allowNull: true
    },
    collectedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    collectedTime: {
      type: DataTypes.STRING,
      allowNull: true
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    dateOfEntry: {
      type: DataTypes.DATEONLY,
      allowNull: false
    }
  },
  {
    tableName: "inward_couriers",
    timestamps: true
  }
);

export default InwardCourier;
