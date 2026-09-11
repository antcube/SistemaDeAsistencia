const isGlobalAdministrator = (user) => {
  if (!user) {
    return false;
  }

  return String(user.adminId || "").trim() === "ADM-001";
};

const isCircleManager = (user) => {
  if (!user) {
    return false;
  }

  return String(user.role || "").trim() === "Gestor de Círculo";
};

const isReadOnlyRole = (user) => {
  if (!user) {
    return false;
  }

  return String(user.role || "").trim() === "Moderador";
};

const getCircleScope = (user) => {
  if (!user) {
    return [];
  }

  if (Array.isArray(user.circleScope)) {
    return user.circleScope
      .map((circle) => String(circle || "").trim())
      .filter(Boolean);
  }

  if (user.circleScope) {
    return [String(user.circleScope).trim()].filter(Boolean);
  }

  return [];
};

const normalizeCircle = (circle) => {
  return String(circle || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const hasCircleAccess = (user, circle) => {
  if (!user || !circle) {
    return false;
  }

  if (isGlobalAdministrator(user)) {
    return true;
  }

  const requestedCircle = normalizeCircle(circle);
  const scope = getCircleScope(user);

  return scope.some(
    (allowedCircle) => normalizeCircle(allowedCircle) === requestedCircle
  );
};

const canManageGlobal = (user) => {
  return isGlobalAdministrator(user);
};

const canManageCircle = (user, circle) => {
  if (!user || !circle) {
    return false;
  }

  if (isGlobalAdministrator(user)) {
    return true;
  }

  if (!isCircleManager(user)) {
    return false;
  }

  return hasCircleAccess(user, circle);
};

const canManageMembers = (user, circle) => {
  return canManageCircle(user, circle);
};

const canManageAttendance = (user, circle) => {
  return canManageCircle(user, circle);
};

const requireGlobalAdministrator = (req, res, next) => {
  if (!isGlobalAdministrator(req.user)) {
    return res.status(403).json({
      message: "No tienes permisos de Administrador Principal.",
    });
  }

  next();
};

const requireWritePermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Usuario no autenticado.",
    });
  }

  if (isReadOnlyRole(req.user)) {
    return res.status(403).json({
      message: "Tu usuario tiene permisos de solo lectura.",
    });
  }

  next();
};

const requireCircleAccess = (req, res, next) => {
  const circle =
    req.params.circle ||
    req.body?.circle ||
    req.query?.circle;

  if (!circle) {
    return res.status(400).json({
      message: "No se especificó el círculo.",
    });
  }

  if (!canManageCircle(req.user, circle)) {
    return res.status(403).json({
      message: "No tienes permisos para operar en este círculo.",
    });
  }

  next();
};

module.exports = {
  isGlobalAdministrator,
  isCircleManager,
  isReadOnlyRole,
  getCircleScope,
  hasCircleAccess,
  canManageGlobal,
  canManageCircle,
  canManageMembers,
  canManageAttendance,
  requireGlobalAdministrator,
  requireWritePermission,
  requireCircleAccess,
};
