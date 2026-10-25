import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  createInterview,
  getInterview,
  listInterviews,
  submitAnswer,
} from "./mock-interview.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", createInterview);
router.get("/", listInterviews);
router.get("/:id", getInterview);
router.post("/:id/answer", submitAnswer);

export default router;