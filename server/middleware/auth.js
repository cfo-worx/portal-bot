// backend/middleware/auth.js

import jwt from 'jsonwebtoken';

export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // Expected format: "Bearer TOKEN"
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.error('JWT verification error:', err);
        return res.sendStatus(403); // Forbidden
      }

      req.user = user; // Attach user info to request
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized
  }
};

// Optional: Role-based authorization
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.sendStatus(403); // Forbidden
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      return res.sendStatus(403); // Forbidden
    }

    next();
  };
};
