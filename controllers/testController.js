// controllers/testController.js - COMPLETE FIX
import Test from "../models/Test.js";

export const createTest = async (req, res, next) => {
    try {
        const {
            title, duration, startTimestamp, startDate, startTime,
            targetAudience, author, passMarks, totalMarks, institute,
            sections = [], facultyEmail
        } = req.body;

        // ✅ FIXED: Validate required fields
        if (!title || !duration || (!startTimestamp && !(startDate && startTime)) || !targetAudience) {
            return res.status(400).json({
                message: "Missing required fields: title, duration, startTimestamp OR (startDate+startTime), targetAudience"
            });
        }

        // ✅ FIXED: Compute timestamps correctly
        let start;
        if (startTimestamp) {
            start = new Date(startTimestamp);
            if (isNaN(start)) return res.status(400).json({ message: "Invalid startTimestamp" });
        } else {
            const iso = `${startDate}T${startTime}:00`;
            start = new Date(iso);
            if (isNaN(start)) return res.status(400).json({ message: "Invalid startDate/startTime" });
        }

        const dur = Number(duration);
        const end = new Date(start.getTime() + dur * 60_000);

        // Build test document ✅ FIXED: All required fields included
        const testData = {
            title, duration: dur, startTimestamp: start, endTimestamp: end,
            targetAudience, // ✅ FIXED: Now included
            courseName: targetAudience, // ✅ FIXED: From targetAudience
            author, institute, facultyEmail,
            sections: sections.length ? sections.map(sec => ({
                name: sec.name || 'General',
                marks: Number(sec.marks || 10),
                questions: (sec.questions || []).map(q => ({
                    questionText: q.questionText || '',
                    options: (q.options || []).map(opt => ({ text: opt.text || opt })),
                    correctOptionId: q.options[q.correctIdx || 0]?._id || new mongoose.Types.ObjectId() // ✅ FIXED: Schema match
                }))
            })) : [{ name: 'General', marks: 10, questions: [] }]
        };

        // Let schema handle passMarks/totalMarks/status computation
        const test = new Test(testData);
        await test.save();

        // ✅ FIXED: Emit COMPLETE payload
        const io = req.app.get("io");
        if (io) {
            const payload = test.toObject(); // Full document
            io.to(`test:${test._id}`).emit("testCreated", payload);
            if (test.targetAudience) {
                const auds = String(test.targetAudience).split(",").map(a => a.trim()).filter(Boolean);
                auds.forEach(a => io.to(`audience:${a}`).emit("testCreated", payload));
            }
        }

        return res.status(201).json({ success: true, test });
    } catch (err) {
        next(err);
    }
};

// ✅ NEW: Automatic status updater (call this every minute via cron)
export const updateAllTestStatuses = async (req, res, next) => {
    try {
        const now = new Date();
        const updates = await Test.updateMany(
            {
                $or: [
                    { startTimestamp: { $lte: now, $gt: { $ifNull: ["$endTimestamp", now] } }, status: { $ne: "ongoing" } },
                    { endTimestamp: { $lte: now }, status: { $ne: "completed" } }
                ]
            },
            [
                {
                    $set: {
                        status: {
                            $cond: {
                                if: { $lte: ["$endTimestamp", now] },
                                then: "completed",
                                else: "ongoing"
                            }
                        }
                    }
                }
            ],
            { runValidators: true }
        );

        // Emit to all affected tests
        const io = req.app.get("io");
        if (io && updates.modifiedCount > 0) {
            const updatedTests = await Test.find({
                _id: { $in: updates.matchedIds || [] }
            }).lean();

            updatedTests.forEach(test => {
                io.to(`test:${test._id}`).emit("testUpdated", test);
                if (test.targetAudience) {
                    const auds = String(test.targetAudience).split(",").map(a => a.trim()).filter(Boolean);
                    auds.forEach(a => io.to(`audience:${a}`).emit("testUpdated", test));
                }
            });
        }

        res.json({ success: true, modifiedCount: updates.modifiedCount });
    } catch (err) {
        next(err);
    }
};

// ✅ IMPROVED: Manual expire (now uses same logic as auto-updater)
export const expireTestById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const now = new Date();

        const updatedTest = await Test.findOneAndUpdate(
            { _id: id, status: { $ne: "completed" } },
            {
                $set: {
                    status: now >= new Date(id.endTimestamp) ? "completed" : "ongoing",
                    updatedAt: now
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedTest) {
            return res.status(404).json({ message: "Test not found or already completed" });
        }

        const io = req.app.get("io");
        if (io) {
            io.to(`test:${updatedTest._id}`).emit("testUpdated", updatedTest.toObject());
        }

        res.json({ success: true, test: updatedTest });
    } catch (err) {
        next(err);
    }
};