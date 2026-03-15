import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const OutwardCourier = sequelize.define(
  "OutwardCourier",
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
    origin: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Sadivayal Office"
    },
    vendor: {
      type: DataTypes.STRING,
      allowNull: false
    },
    trackingNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    senderName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    senderContact: {
      type: DataTypes.STRING,
      allowNull: false
    },
    senderDept: {
      type: DataTypes.STRING,
      allowNull: false
    },
    receiverName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    receiverAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    receiverContact: {
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
    estCost: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "0"
    },
    actualCost: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM("requested", "sent", "in-transit", "delivered", "cancelled", "returned"),
      allowNull: false,
      defaultValue: "sent"
    },
    dispatchDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    dispatchTime: {
      type: DataTypes.STRING,
      allowNull: false
    },
    deliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    deliveryTime: {
      type: DataTypes.STRING,
      allowNull: true
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    statusTimeline: {
      type: DataTypes.TEXT("long"),
      allowNull: true
    },
    dateOfEntry: {
      type: DataTypes.DATEONLY,
      allowNull: false
    }
  },
  {
    tableName: "outward_couriers",
    timestamps: true
  }
);

export default OutwardCourier;
