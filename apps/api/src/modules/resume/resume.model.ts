
import mongoose, { Schema } from "mongoose";

const resumeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
      default: "My Resume",
    },

    resumeTemplate: {
      type: String,
      enum: ["modern", "ats"],
      default: "modern",
    },

    personalInfo: {
      name: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        maxlength: 254,
        default: "",
      },
      phone: {
        type: String,
        trim: true,
        maxlength: 40,
        default: "",
      },
      location: {
        type: String,
        trim: true,
        maxlength: 150,
        default: "",
      },
    },

    role: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    summary: {
      type: String,
      maxlength: 5000,
      default: "",
    },

    education: {
      type: String,
      maxlength: 5000,
      default: "",
    },

    skills: {
      type: String,
      maxlength: 5000,
      default: "",
    },

    projects: {
      type: String,
      maxlength: 10000,
      default: "",
    },

    experience: {
      type: String,
      maxlength: 10000,
      default: "",
    },

    certifications: {
      type: String,
      maxlength: 5000,
      default: "",
    },

    achievements: {
      type: String,
      maxlength: 5000,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

resumeSchema.index({ userId: 1, updatedAt: -1 });

export const Resume = mongoose.model("Resume", resumeSchema);
