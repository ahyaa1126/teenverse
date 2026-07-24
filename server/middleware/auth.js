const jwt = require("jsonwebtoken");

function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Please log in again." });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.auth.role)) {
        return res.status(403).json({ message: "You do not have permission for this action." });
      }
      next();
    });
  };
}

const requireOwner = requireRoles("OWNER");

module.exports = { requireAuth, requireRoles, requireOwner };
