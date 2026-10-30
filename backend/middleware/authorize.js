const requireAdmin = (req, res, next) => {
  const user = req.user || req.admin;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const role = String(user.role || '').toLowerCase();
  const isAdmin =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'superadmin' ||
    role === 'subadmin' ||
    role === 'sub_admin' ||
    Boolean(user.isAdmin || user.is_admin) ||
    (role !== 'student' && role !== 'parent');

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Administrator access required'
    });
  }

  next();
};

module.exports = {
  requireAdmin
};
