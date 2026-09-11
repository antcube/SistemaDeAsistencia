const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "ordenado_jwt_secret";

const authMiddleware = (
  req,
  res,
  next
) => {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        message:
          "No se proporcionó el token de autenticación.",
      });
    }

    const parts =
      authorization.split(" ");

    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer"
    ) {
      return res.status(401).json({
        message:
          "Formato de token inválido.",
      });
    }

    const token = parts[1];

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    req.user = decoded;

    // Compatibilidad con controladores
    // que utilizan req.admin.
    req.admin = decoded;

    next();
  } catch (error) {
    console.error(
      "Error verificando token:",
      error.message
    );

    return res.status(401).json({
      message:
        "Token inválido o expirado.",
    });
  }
};

module.exports =
  authMiddleware;