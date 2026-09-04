const jwt = require("jsonwebtoken");

const User = require("../models/User");
const config = require("../config/jwtConfig");

/**
 * Requires a valid JWT token and loads the authenticated user.
 *
 * The token is expected in the x-access-token header,
 * following the approach used in the practical class examples.
 */
async function requireApiAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = req.headers["x-access-token"];

    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return res.status(401).json({
        message: "Authentication token is required.",
      });
    }

    const decodedToken = jwt.verify(token, config.secret);

    const user = await User.findById(decodedToken.id).select("-passwordHash");

    if (!user || !user.active) {
      return res.status(401).json({
        message: "Invalid or inactive user.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}

/**
 * Requires the authenticated user to be a client.
 */
function requireApiClient(req, res, next) {
  if (!req.user || req.user.role !== "client") {
    return res.status(403).json({
      message: "Client access required.",
    });
  }

  next();
}

module.exports = {
  requireApiAuth,
  requireApiClient,
};
