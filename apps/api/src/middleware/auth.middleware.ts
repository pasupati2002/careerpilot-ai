
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      success: false,
      message: "Authentication is not configured",
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string"
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
      return;
    }

    authReq.user = {
      id: payload.sub,
      role:
        typeof payload.role === "string"
          ? payload.role
          : "user",
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}
