
import mongoose, { Schema } from "mongoose";

const consultantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    expertise: {
      type: [String],
      required: true,
      validate: {
        validator: (items: string[]) => items.length > 0,
        message: "At least one expertise area is required",
      },
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    feePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 15,
      max: 180,
      default: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

consultantSchema.index({ isActive: 1, name: 1 });

export const Consultant = mongoose.model(
  "Consultant",
  consultantSchema
);
