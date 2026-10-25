
import { Router } from "express";
import { login, register } from "./auth.controller.js";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/me", requireAuth, (req, res) => {
  const authReq = req as AuthenticatedRequest;

  res.status(200).json({
    success: true,
    user: authReq.user,
  });
});

export default router;
