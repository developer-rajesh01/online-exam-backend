// models/Attempt.js
import mongoose from "mongoose";

const AttemptSchema = new mongoose.Schema(
    {
        testId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Test",
            required: true,
        },

        studentEmail: {
            type: String,
            required: true,
            index: true,
        },

        startedAt: {
            type: Date,
            default: Date.now,
        },

        submittedAt: {
            type: Date,
        },

        durationMinutes: {
            type: Number,
        },

        // ✅ FIXED ANSWER STRUCTURE (NO qIndex)
        answers: [
            {
                questionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                },
                selectedOptionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    default: null,
                },
                submittedAt: {
                    type: Date,
                },
            },
        ],

        score: {
            type: Number,
            default: 0,
        },

        totalMarks: {
            type: Number,
        },

        exitCount: {
            type: Number,
            default: 0,
        },

        status: {
            type: String,
            enum: ["in-progress", "submitted", "forfeited", "blocked"],
            default: "in-progress",
            index: true,
        },

        blocked: {
            type: Boolean,
            default: false,
        },

        // Optional: detailed result storage
        results: [
            {
                questionId: mongoose.Schema.Types.ObjectId,
                correct: Boolean,
                selected: mongoose.Schema.Types.ObjectId,
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.model("Attempt", AttemptSchema);