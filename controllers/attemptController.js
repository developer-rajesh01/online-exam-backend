// controllers/attemptController.js - CREATE THIS FILE
import Attempt from "../models/Attempt.js";
import Test from "../models/Test.js";

export const createAttempt = async (req, res) => {
    try {
        const { testId } = req.body;

        // ✅ VALIDATE testId
        if (!testId) {
            return res.status(400).json({ error: "testId required" });
        }

        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ error: "Test not found" });
        }

        // Check if attempt already exists
        const existing = await Attempt.findOne({
            testId,
            studentId: req.user.id,
            status: { $in: ["started", "in_progress"] }
        });
        if (existing) {
            return res.json(existing);
        }

        const attempt = new Attempt({
            testId: test._id,  // ✅ FIXED: Always save testId
            studentId: req.user.id,
            status: "started",
            startedAt: new Date(),
            answers: [],
            score: null,
            blocked: false,
            exitCount: 0,
            durationMinutes: test.duration
        });

        await attempt.save();
        res.status(201).json(attempt);
    } catch (error) {
        console.error("Create attempt error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getAttempt = async (req, res) => {
    try {
        const attempt = await Attempt.findById(req.params.id)
            .populate("testId", "title duration sections totalMarks institute courseName targetAudience");

        if (!attempt) {
            return res.status(404).json({ error: "Attempt not found" });
        }

        // ✅ Ensure testId exists in response
        if (!attempt.testId) {
            return res.status(400).json({ error: "Invalid attempt - missing testId" });
        }

        res.json(attempt);
    } catch (error) {
        console.error("Get attempt error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const saveAttemptProgress = async (req, res) => {
    try {
        const { answers } = req.body;
        const attempt = await Attempt.findByIdAndUpdate(
            req.params.id,
            {
                answers: answers.map(ans => ({
                    questionId: ans.questionId,
                    selectedIdx: ans.selectedIdx
                })),
                updatedAt: new Date()
            },
            { new: true }
        );
        res.json(attempt);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const submitAttempt = async (req, res) => {
    try {
        const { answers, forfeit, reason } = req.body;
        const attempt = await Attempt.findById(req.params.id).populate("testId");

        if (!attempt) {
            return res.status(404).json({ error: "Attempt not found" });
        }

        // Calculate score
        let score = 0;
        const test = attempt.testId;
        answers.forEach(ans => {
            const question = test.sections
                .flatMap(sec => sec.questions)
                .find((_, idx) => idx === ans.questionId);

            if (question && ans.selectedIdx === question.correctIdx) {
                score += 1;
            }
        });

        await Attempt.findByIdAndUpdate(req.params.id, {
            status: forfeit ? "forfeited" : "completed",
            answers: answers.map(ans => ({
                questionId: ans.questionId,
                selectedIdx: ans.selectedIdx
            })),
            score,
            submittedAt: new Date(),
            forfeitReason: reason
        });

        res.json({ success: true, score, total: test.totalMarks });
    } catch (error) {
        console.error("Submit error:", error);
        res.status(500).json({ error: error.message });
    }
};
