const jwt = require("jsonwebtoken");

// Roles: owner, head, teacher, parent
function auth(roles = []) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Please sign in" });
    try {
      const u = jwt.verify(token, process.env.JWT_SECRET);
      if (roles.length && !roles.includes(u.role))
        return res.status(403).json({ error: "Not allowed" });
      req.user = u; // { id, role, schoolId }
      next();
    } catch (e) {
      res.status(401).json({ error: "Session expired, sign in again" });
    }
  };
}

module.exports = auth;
