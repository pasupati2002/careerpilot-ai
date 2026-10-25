import mongoose, { Schema, Types } from "mongoose";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface ChatSessionDocument extends mongoose.Document {
  userId: Types.ObjectId;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<ChatMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const chatSessionSchema = new Schema<ChatSessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Career Chat",
      trim: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });

const ChatSession =
  mongoose.models.ChatSession ||
  mongoose.model<ChatSessionDocument>("ChatSession", chatSessionSchema);

export default ChatSession;
