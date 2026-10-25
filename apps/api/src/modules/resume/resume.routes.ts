
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { analyzeResume } from "./resume.controller.js";
import { generateResumeSummary } from "./resume-builder.controller.js";
import {
  getSavedResume,
  saveResume,
} from "./resume-crud.controller.js";

const router = Router();

router.use(requireAuth);

// Existing Resume Assistant and AI summary routes
router.post("/analyze", analyzeResume);
router.post("/generate", generateResumeSummary);

// Resume Builder persistence routes
router.get("/builder", getSavedResume);
router.put("/builder", saveResume);

export default router;
