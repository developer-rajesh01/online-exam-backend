import express from "express";
import {
  saveResult,
  getUserResults,
  getAllResults,
} from "../controllers/resultController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", protect, saveResult);
router.get("/user", protect, getUserResults);
router.get("/all", protect, getAllResults);

export default router;
