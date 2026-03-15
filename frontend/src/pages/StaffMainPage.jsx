import { Navigate } from "react-router-dom";

export default function StaffMainPage() {
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "Admin") return <Navigate to="/main/admin" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (user.role !== "Courier Office Staff") return <Navigate to="/login" replace />;

  return (
    <div className="simple-main-wrap">
      <div className="simple-main-card">
        <h1>Courier Office Staff Main Page</h1>
        <p>Staff dashboard placeholder.</p>
      </div>
    </div>
  );
}
