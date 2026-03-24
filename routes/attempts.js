import mongoose from "mongoose";
import express from "express";
import Test from "../models/Test.js";
import Attempt from "../models/Attempt.js";

const router = express.Router();
// 🔥 TEACHER VIEW - ALL ATTEMPTS FOR A TEST (ADD THIS)
router.get("/test/:testId", async (req, res) => {
    try {
        const { testId } = req.params;

        const attempts = await Attempt.find({ testId })
            .populate('testId', 'title duration totalMarks passMarks')
            .sort({ submittedAt: -1 })
            .lean();

        res.json({
            success: true,
            attempts,
            count: attempts.length
        });
    } catch (err) {
        console.error('Attempts fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const studentEmail = req.query.email;

        if (!studentEmail) {
            return res.status(400).json({ error: "studentEmail required" });
        }

        const attempts = await Attempt.find({ studentEmail })
            .populate('testId', 'title duration totalMarks')
            .lean();

        res.json({ success: true, attempts });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/*
=========================================
1️⃣ CREATE ATTEMPT
POST /api/attempts/:testId/start
=========================================
*/
router.post("/:testId/start", async (req, res) => {
    try {
        const { testId } = req.params;
        const { studentEmail } = req.body;

        // 🔥 FIX 1: Validate testId is VALID ObjectId
        if (!mongoose.Types.ObjectId.isValid(testId)) {
            return res.status(400).json({ error: `Invalid testId: ${testId}` });
        }

        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ error: "Test not found" });
        }

        // 🔥 FIX 2: Use test._id (ObjectId) not string
        const attempt = new Attempt({
            testId: test._id,  // ✅ ObjectId!
            studentEmail,
            durationMinutes: test.duration,
            totalMarks: test.totalMarks,
            status: "in-progress",
            answers: []
        });

        await attempt.save();
        res.status(201).json({
            success: true,
            attemptId: attempt._id,
            testId: test._id.toString(),  // ✅ Frontend needs string
            durationMinutes: test.duration
        });
    } catch (err) {
        console.error("START ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});



/*
=========================================
2️⃣ SUBMIT ATTEMPT
PUT /api/attempts/:attemptId/submit
=========================================
*/
router.put("/:attemptId/submit", async (req, res) => {

    const { attemptId } = req.params;
    const { answers, forfeit, reason } = req.body;

    const attempt = await Attempt.findById(attemptId).populate("testId");
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });

    const test = attempt.testId;

    // 🔥 flatten questions
    const allQuestions = (test.sections || []).flatMap(sec => sec.questions);

    const normalizedAnswers = answers.map(ans => {

        const question = allQuestions.find(
            q => q._id.toString() === ans.questionId
        );

        if (!question) return null;

        const option = question.options?.[ans.selectedIdx];

        return {
            questionId: question._id,
            selectedOptionId: option?._id || null,
            submittedAt: new Date()
        };

    }).filter(Boolean);
    // score
    let score = 0;

    allQuestions.forEach(question => {

        const studentAnswer = normalizedAnswers.find(a =>
            a.questionId.toString() === question._id.toString()
        );

        if (
            studentAnswer?.selectedOptionId?.toString() ===
            question.correctOptionId?.toString()
        ) {
            score += question.marks || 1;
        }

    });

    attempt.status = "submitted";
    attempt.answers = normalizedAnswers;
    attempt.score = score;
    attempt.submittedAt = new Date();
    attempt.forfeit = !!forfeit;
    attempt.reason = reason || "manual";

    await attempt.save();

    res.json({
        success: true,
        score,
        totalMarks: attempt.totalMarks
    });

});

router.put("/attempts/:attemptId/save", async (req, res) => {
    try {
        const { attemptId } = req.params;
        const { answers } = req.body;

        const attempt = await Attempt.findById(attemptId);

        if (!attempt) {
            return res.status(404).json({ message: "Attempt not found" });
        }

        attempt.answers = answers;
        await attempt.save();

        res.json({ success: true, message: "Answers saved successfully" });

    } catch (err) {
        console.error("Save error:", err);
        res.status(500).json({ message: "Server error" });
    }
});
/*
=========================================
3️⃣ GET SINGLE ATTEMPT
GET /api/attempts/:attemptId
=========================================
*/
// 🔥 ADD THIS - LIST ALL ATTEMPTS
// 🔥 LIST ALL ATTEMPTS - PUT THIS FIRST (BEFORE other routes)



router.get("/:attemptId", async (req, res) => {
    try {
        const attempt = await Attempt.findById(req.params.attemptId)
            .populate("testId", "title duration totalMarks questions")
            .lean();

        if (!attempt) {
            return res.status(404).json({ message: "Attempt not found" });
        }

        res.json({
            success: true,
            attempt
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch attempt" });
    }
});


export default router;