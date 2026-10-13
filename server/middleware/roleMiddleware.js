
function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.worker || !allowedRoles.includes(req.worker.role)) {
      return res.status(403).json({
        message: "You do not have permission to access this resource."
      });
    }

    next();
  };
}

module.exports = allowRoles;
