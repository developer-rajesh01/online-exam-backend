import express from "express";
import {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
} from "../controllers/examController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

// Routes
router.post("/", protect, createExam);
router.get("/", protect, getExams);
router.get("/:id", protect, getExamById);
router.put("/:id", protect, updateExam);
router.delete("/:id", protect, deleteExam);

export default router;
