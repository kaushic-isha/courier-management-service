export default function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    const role = req.auth?.role;
    if (!role) return res.status(403).json({ message: "Access denied." });
    if (!roles.includes(role)) return res.status(403).json({ message: "Insufficient permissions." });
    return next();
  };
}
