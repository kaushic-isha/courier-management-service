import { Navigate, useNavigate } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";
import Breadcrumbs from "../components/Breadcrumbs";

function GuardAdmin({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Courier Office Staff") return <Navigate to="/main/staff" replace />;
  if (user.role === "Department User") return <Navigate to="/main/department" replace />;
  if (user.role !== "Admin") return <Navigate to="/login" replace />;
  return null;
}

export default function AdminSectionPlaceholder({ title, activePath }) {
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const navigate = useNavigate();
  const guard = GuardAdmin({ user });
  if (guard) return guard;

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  }

  return (
    <div className="main-shell">
      <AdminHeader activePath={activePath} user={user} onLogout={handleLogout} />
      <main className="main-content">
        <Breadcrumbs items={[{ label: "Home", to: "/main/admin" }, { label: title }]} />
        <h2>{title}</h2>
        <p>This section is ready for implementation.</p>
      </main>
    </div>
  );
}
