// import express from "express";
// import {
//   addQuestion,
//   getQuestionsByExam,
//   deleteQuestion,
// } from "../controllers/questionController.js";
// import protect from "../middlewares/authMiddleware.js";

// const router = express.Router();

// router.post("/", protect, addQuestion);
// router.get("/:examId", protect, getQuestionsByExam);
// router.delete("/:id", protect, deleteQuestion);

// export default router;


import express from "express";
import {
  bulkAddQuestions,
  getAllQuestions,
} from "../controllers/questionController.js";

const router = express.Router();

// Bulk insert questions
router.post("/bulk", bulkAddQuestions);

// Get all questions
router.get("/", getAllQuestions);

export default router;
