import { Navigate, Route, Routes } from "react-router-dom";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import AdminMainPage from "./pages/AdminMainPage";
import DepartmentMainPage from "./pages/DepartmentMainPage";
import InwardPage from "./pages/Inward";
import AddInwardCourierPage from "./pages/AddInwardCourier";
import InwardDetailsPage from "./pages/InwardDetails";
import DepartmentOutwardRequestPage from "./pages/DepartmentOutwardRequest";
import DepartmentRequestsPage from "./pages/DepartmentRequests";
import StaffRequestsPage from "./pages/StaffRequests";
import InwardBulkCollection from "./pages/InwardBulkCollection";
import InwardBulkParcel from "./pages/InwardBulkParcel";
import InwardBulkStatus from "./pages/InwardBulkStatus";
import OutwardPage from "./pages/Outward";
import AddOutwardCourierPage from "./pages/AddOutwardCourier";
import OutwardDetailsPage from "./pages/OutwardDetails";
import ReportsPage from "./pages/Reports";
import UsersPage from "./pages/Users";
import UserApprovalsPage from "./pages/UserApprovals";
import AdminSettingsPage from "./pages/AdminSettings";
import AdminDepartmentsPage from "./pages/AdminDepartments";

function getMainPathByRole(role) {
  if (role === "Admin") return "/main/admin";
  if (role === "Courier Office Staff") return "/main/admin";
  if (role === "Department User") return "/main/department";
  return "/login";
}

function MainRedirect() {
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  return <Navigate to={getMainPathByRole(user?.role)} replace />;
}

function StaffRedirect() {
  return <Navigate to="/main/admin" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/main" element={<MainRedirect />} />
      <Route path="/main/admin" element={<AdminMainPage />} />
      <Route path="/main/admin/inward" element={<InwardPage />} />
      <Route path="/main/admin/inward/new" element={<AddInwardCourierPage />} />
      <Route path="/main/admin/inward/:id/edit" element={<AddInwardCourierPage />} />
      <Route path="/main/admin/inward/bulk/collection" element={<InwardBulkCollection />} />
      <Route path="/main/admin/inward/bulk/parcel" element={<InwardBulkParcel />} />
      <Route path="/main/admin/inward/bulk/status" element={<InwardBulkStatus />} />
      <Route path="/main/admin/inward/:id" element={<InwardDetailsPage />} />
      <Route path="/main/admin/outward" element={<OutwardPage />} />
      <Route path="/main/admin/outward/new" element={<AddOutwardCourierPage />} />
      <Route path="/main/admin/outward/:id" element={<OutwardDetailsPage />} />
      <Route path="/main/admin/outward/:id/edit" element={<AddOutwardCourierPage />} />
      <Route path="/main/admin/requests" element={<StaffRequestsPage />} />
      <Route
        path="/main/admin/reports"
        element={<ReportsPage />}
      />
      <Route
        path="/main/admin/settings"
        element={<AdminSettingsPage />}
      />
      <Route
        path="/main/admin/settings/departments"
        element={<AdminDepartmentsPage />}
      />
      <Route
        path="/main/admin/users"
        element={<UsersPage />}
      />
      <Route
        path="/main/admin/approvals"
        element={<UserApprovalsPage />}
      />
      <Route path="/main/staff" element={<StaffRedirect />} />
      <Route path="/main/staff/inward/:id" element={<InwardDetailsPage />} />
      <Route path="/main/department" element={<DepartmentMainPage />} />
      <Route path="/main/department/inward" element={<InwardPage />} />
      <Route path="/main/department/outward" element={<OutwardPage />} />
      <Route path="/main/department/reports" element={<ReportsPage />} />
      <Route path="/main/department/outward/request" element={<DepartmentOutwardRequestPage />} />
      <Route path="/main/department/requests" element={<DepartmentRequestsPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
