import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const ROLES = [
  { label: "Department User (view only)", value: "Department User" },
  { label: "Admin", value: "Admin" },
  { label: "Courier Office Staff", value: "Courier Office Staff" }
];

const DEPARTMENTS = [
  "Ashram Programs",
  "Ashram Admin",
  "VCD",
  "IT",
  "E Media",
  "Akshaya",
  "IPC",
  "IPC Backoffice",
  "OCO",
  "Sadhanapada"
];
const LOCATIONS = ["Sadivayal Office", "Ashram"];

function getMainPathByRole(role) {
  if (role === "Admin") return "/main/admin";
  if (role === "Courier Office Staff") return "/main/admin";
  if (role === "Department User") return "/main/department";
  return "/login";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Department User");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState(ROLES);
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [departmentsByLocation, setDepartmentsByLocation] = useState({});
  const [locations, setLocations] = useState(LOCATIONS);

  const isDepartmentUser = role === "Department User";
  const needsLocation = role === "Department User" || role === "Courier Office Staff";

  useEffect(() => {
    async function loadOptions() {
      try {
        const optRes = await fetch("/api/auth/options");

        if (optRes.ok) {
          const optData = await optRes.json();
          const nextRoles = Array.isArray(optData.roles) && optData.roles.length ? optData.roles : ROLES.map((r) => r.value);
          const nextDepts = Array.isArray(optData.departments) ? optData.departments : [];
          const nextDepartmentsByLocation = optData.departmentsByLocation || {};
          setRoles(nextRoles.map((value) => {
            const existing = ROLES.find((r) => r.value === value);
            return existing || { label: value, value };
          }));
          const nextLocations = Array.isArray(optData.locations) && optData.locations.length ? optData.locations : LOCATIONS;
          setDepartments(nextDepts);
          setDepartmentsByLocation(nextDepartmentsByLocation);
          setLocations(nextLocations);
          if (nextRoles.length && !nextRoles.includes(role)) setRole(nextRoles[0]);
          if (nextDepts.length && !nextDepts.includes(department)) setDepartment(nextDepts[0]);
          if (nextLocations.length && !nextLocations.includes(location)) setLocation(nextLocations[0]);
        }
      } catch (_error) {
        // keep local defaults
      }
    }

    loadOptions();
  }, []);

  useEffect(() => {
    if (!isDepartmentUser) return;
    const visible = departmentsByLocation[location] || departments;
    if (visible.length && !visible.includes(department)) {
      setDepartment(visible[0]);
    }
  }, [isDepartmentUser, location, departmentsByLocation, departments, department]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role,
          department: isDepartmentUser ? department : null,
          location: needsLocation ? location : null,
          email,
          password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || "Login failed.");
        return;
      }

      localStorage.setItem("loggedInUser", JSON.stringify(data.user));
      localStorage.setItem("authToken", data.token || "");
      navigate(getMainPathByRole(data.user?.role));
    } catch (_error) {
      alert("Unable to reach server.");
    } finally {
      setLoading(false);
    }
  }

  const visibleDepartments = isDepartmentUser ? departmentsByLocation[location] || departments : departments;

  return (
    <div className="container auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <div className="auth-logo">CM</div>
          <h1 className="auth-title">Courier Management System</h1>
          <p className="auth-subtitle">Sign in to manage your couriers</p>
        </div>

        <label htmlFor="role" className="field-label">
          Select Role <span className="required">*</span>
        </label>
        <select
          id="role"
          className="field-control"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {roles.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        {isDepartmentUser && (
          <p className="helper-text">View-only access to your department's courier data</p>
        )}

        {needsLocation && (
          <>
            <label htmlFor="location" className="field-label">
              Location <span className="required">*</span>
            </label>
            <select
              id="location"
              className="field-control"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              {locations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </>
        )}

        {isDepartmentUser && (
          <>
            <label htmlFor="department" className="field-label">
              Department <span className="required">*</span>
            </label>
            <select
              id="department"
              className="field-control"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {visibleDepartments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </>
        )}

        <label htmlFor="email" className="field-label">
          Email Address
        </label>
        <div className="input-with-icon">
          <span className="input-icon">@</span>
          <input
            id="email"
            className="field-control with-icon"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            required
          />
        </div>

        <label htmlFor="password" className="field-label">
          Password
        </label>
        <div className="input-with-icon">
          <span className="input-icon">#</span>
          <input
            id="password"
            className="field-control with-icon"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>

        <a className="forgot-link" href="#">
          Forgot Password?
        </a>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="switch-auth-text">
          New user?{" "}
          <Link className="switch-auth-link" to="/register">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
