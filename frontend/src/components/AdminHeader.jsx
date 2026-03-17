import { Link } from "react-router-dom";

const ADMIN_NAV_ITEMS = [
  { label: "Home", path: "/main/admin" },
  { label: "Inward", path: "/main/admin/inward" },
  { label: "Outward", path: "/main/admin/outward" },
  { label: "Requests", path: "/main/admin/requests" },
  { label: "Reports", path: "/main/admin/reports" },
  { label: "Admin Settings", path: "/main/admin/settings" },
  { label: "Users", path: "/main/admin/users" }
];

const STAFF_NAV_ITEMS = [
  { label: "Home", path: "/main/admin" },
  { label: "Inward", path: "/main/admin/inward" },
  { label: "Outward", path: "/main/admin/outward" },
  { label: "Requests", path: "/main/admin/requests" },
  { label: "Reports", path: "/main/admin/reports" }
];

const DEPARTMENT_NAV_ITEMS = [
  { label: "Home", path: "/main/department" },
  { label: "Inward", path: "/main/department/inward" },
  { label: "Outward", path: "/main/department/outward" },
  { label: "Requests", path: "/main/department/requests" },
  { label: "Reports", path: "/main/department/reports" }
];

export default function AdminHeader({ activePath = "/main/admin", user, onLogout }) {
  const role = user?.role || "Admin";
  const navItems =
    role === "Department User"
      ? DEPARTMENT_NAV_ITEMS
      : role === "Courier Office Staff"
        ? STAFF_NAV_ITEMS
        : ADMIN_NAV_ITEMS;
  const isHomePath = ["/main/admin", "/main/department"].includes(activePath);

  function isItemActive(path) {
    if (path === "/main/admin" || path === "/main/department") {
      return activePath === path;
    }
    if (isHomePath) return false;
    return activePath.startsWith(path);
  }

  const showApprovalsLink = user?.role === "Admin" || Boolean(user?.canApproveUsers);
  const approvalsPath = "/main/admin/approvals";

  return (
    <header className="admin-header">
      <div className="brand-wrap">
        <div className="brand-icon-box">CM</div>
        <div className="brand-title">Courier Management</div>
      </div>

      <nav className="admin-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-link ${isItemActive(item.path) ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
        {showApprovalsLink && (
          <Link
            to={approvalsPath}
            className={`nav-link ${isItemActive(approvalsPath) ? "active" : ""}`}
          >
            Approvals
          </Link>
        )}
      </nav>

      <div className="admin-right">
        <div className="user-stack">
          <span className="user-name">{user?.email || "Admin"}</span>
          <span className="user-role">{role}</span>
          {user?.location ? <span className="user-role">{user.location}</span> : null}
        </div>
        <span className="role-chip">{role}</span>
        <button type="button" className="logout-link" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
