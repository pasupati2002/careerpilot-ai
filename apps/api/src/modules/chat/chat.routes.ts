
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  createChat,
  listChats,
  getChat,
  sendMessage,
  renameChat,
  deleteChat,
} from "./chat.controller.js";

const router = Router();

// All chat endpoints require authentication.
router.use(requireAuth);

router.post("/", createChat);
router.get("/", listChats);
router.get("/:chatId", getChat);
router.patch("/:chatId", renameChat);
router.delete("/:chatId", deleteChat);
router.post("/:chatId/messages", sendMessage);

export default router;
