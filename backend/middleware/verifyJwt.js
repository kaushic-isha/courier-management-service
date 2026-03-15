import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "courier-dev-secret-change-me";

export function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

export default function verifyJwt(req, res, next) {
  const auth = req.headers.authorization || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid authorization token." });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
