
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../users/user.model.js";
import { registerSchema, loginSchema } from "./auth.validation.js";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  return secret;
}

export async function register(req: Request, res: Response) {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid registration details",
      errors: z.treeifyError(result.error),
    });
  }

  try {
    const { name, email, password } = result.data;
    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error("Registration failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create account",
    });
  }
}

export async function login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid login details",
      errors: z.treeifyError(result.error),
    });
  }

  try {
    const { email, password } = result.data;

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      getJwtSecret(),
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error("Login failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in",
    });
  }
}
