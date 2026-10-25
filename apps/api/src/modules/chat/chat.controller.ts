
import type { Response } from "express";
import { Types } from "mongoose";
import ollama from "ollama";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import ChatSession from "./chat.model.js";

const AI_MODEL = "llama3.2:3b";

const SYSTEM_PROMPT =
  "You are CareerPilot AI, a helpful career advisor for students, fresh graduates, and professionals. Give practical, clear, encouraging advice about careers, interviews, skills, job searches, resumes, and professional development. Use numbered steps when helpful. Never guarantee employment.";

function getUserId(req: AuthenticatedRequest): string | null {
  return req.user?.id || null;
}

export async function createChat(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }

    const title =
      typeof req.body?.title === "string" && req.body.title.trim()
        ? req.body.title.trim().slice(0, 80)
        : "New Career Chat";

    const chat = await ChatSession.create({
      userId: new Types.ObjectId(userId),
      title,
      messages: [],
    });

    res.status(201).json({ success: true, chat });
  } catch (error) {
    console.error("Create chat error:", error);
    res.status(500).json({
      success: false,
      message: "Could not create chat.",
    });
  }
}

export async function listChats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }

    const chats = await ChatSession.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select("title messages createdAt updatedAt");

    res.status(200).json({ success: true, chats });
  } catch (error) {
    console.error("List chats error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load chats.",
    });
  }
}

export async function getChat(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);
    const chatId = String(req.params.chatId || "");

    if (!userId) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }

    if (!Types.ObjectId.isValid(chatId)) {
      res.status(400).json({ success: false, message: "Invalid chat ID." });
      return;
    }

    const chat = await ChatSession.findOne({ _id: chatId, userId });

    if (!chat) {
      res.status(404).json({ success: false, message: "Chat not found." });
      return;
    }

    res.status(200).json({ success: true, chat });
  } catch (error) {
    console.error("Get chat error:", error);
    res.status(500).json({
      success: false,
      message: "Could not open chat.",
    });
  }
}

export async function sendMessage(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const chatId = String(req.params.chatId || "");
  const content =
    typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (!userId) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  if (!Types.ObjectId.isValid(chatId)) {
    res.status(400).json({ success: false, message: "Invalid chat ID." });
    return;
  }

  if (!content || content.length > 4000) {
    res.status(400).json({
      success: false,
      message: "Enter a message of 1 to 4000 characters.",
    });
    return;
  }

  try {
    const chat = await ChatSession.findOne({ _id: chatId, userId });

    if (!chat) {
      res.status(404).json({ success: false, message: "Chat not found." });
      return;
    }

    const history = chat.messages.slice(-12).map(
      (message: { role: "user" | "assistant"; content: string }) => ({
        role: message.role,
        content: message.content,
      })
    );

    let aiResponse: string;

    try {
      const result = await ollama.chat({
        model: AI_MODEL,
        think: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history,
          { role: "user", content },
        ],
        options: {
          num_predict: 600,
        },
      });

      aiResponse = result.message.content.trim();

      if (!aiResponse) {
        throw new Error("The AI returned an empty response.");
      }
    } catch (error) {
      // Keep technical details in the server logs, not in the API response.
      console.error("Ollama request failed:", error);

      res.status(502).json({
        success: false,
        message:
          "The AI assistant is temporarily unavailable. Please try again shortly.",
      });
      return;
    }

    chat.messages.push(
      { role: "user", content, createdAt: new Date() },
      { role: "assistant", content: aiResponse, createdAt: new Date() }
    );

    if (!chat.title || chat.title === "New Career Chat") {
      chat.title = content.slice(0, 60);
    }

    await chat.save();

    res.status(200).json({
      success: true,
      message: "AI response generated successfully.",
      chat,
      reply: aiResponse,
    });
  } catch (error) {
    console.error("Send chat message error:", error);

    res.status(500).json({
      success: false,
      message: "Could not send your message.",
    });
  }
}

export async function renameChat(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);
    const chatId = String(req.params.chatId || "");
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";

    if (!userId) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }

    if (!Types.ObjectId.isValid(chatId)) {
      res.status(400).json({ success: false, message: "Invalid chat ID." });
      return;
    }

    if (!title || title.length > 80) {
      res.status(400).json({
        success: false,
        message: "Chat title must be between 1 and 80 characters.",
      });
      return;
    }

    const chat = await ChatSession.findOneAndUpdate(
      { _id: chatId, userId },
      { $set: { title } },
      { new: true, runValidators: true }
    );

    if (!chat) {
      res.status(404).json({ success: false, message: "Chat not found." });
      return;
    }

    res.status(200).json({ success: true, chat });
  } catch (error) {
    console.error("Rename chat error:", error);
    res.status(500).json({
      success: false,
      message: "Could not rename chat.",
    });
  }
}

export async function deleteChat(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = getUserId(req);
    const chatId = String(req.params.chatId || "");

    if (!userId) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }

    if (!Types.ObjectId.isValid(chatId)) {
      res.status(400).json({ success: false, message: "Invalid chat ID." });
      return;
    }

    const chat = await ChatSession.findOneAndDelete({
      _id: chatId,
      userId,
    });

    if (!chat) {
      res.status(404).json({ success: false, message: "Chat not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Chat deleted successfully.",
    });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({
      success: false,
      message: "Could not delete chat.",
    });
  }
}
