
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/database.js";
import { Consultant } from "../modules/consultations/consultant.model.js";

dotenv.config();

const sampleConsultants = [
  {
    name: "Ananya Sharma",
    title: "Career Strategy Consultant",
    expertise: ["Career Planning", "Career Change", "Interview Preparation"],
    bio: "Helps professionals clarify career goals and prepare for their next opportunity.",
    feePaise: 99900,
    durationMinutes: 30,
    isActive: true,
  },
  {
    name: "Rahul Mehta",
    title: "Resume and ATS Specialist",
    expertise: ["Resume Review", "ATS Optimization", "LinkedIn Profiles"],
    bio: "Supports job seekers with clear, recruiter-friendly resumes and job-search strategy.",
    feePaise: 79900,
    durationMinutes: 30,
    isActive: true,
  },
  {
    name: "Priya Das",
    title: "Technical Interview Mentor",
    expertise: ["Technical Interviews", "Software Careers", "Mock Interviews"],
    bio: "Helps software candidates structure interview preparation and communicate their experience.",
    feePaise: 129900,
    durationMinutes: 45,
    isActive: true,
  },
];

async function seedConsultants(): Promise<void> {
  try {
    await connectDB();

    for (const consultantData of sampleConsultants) {
      await Consultant.updateOne(
        { name: consultantData.name },
        { $set: consultantData },
        { upsert: true, runValidators: true }
      );
    }

    console.log(`Seeded ${sampleConsultants.length} sample consultants.`);
  } catch (error) {
    console.error("Failed to seed consultants:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void seedConsultants();
