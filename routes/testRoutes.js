import express from "express";
import Test from "../models/Test.js";
import mongoose from 'mongoose'; 
import protect from "../middlewares/authMiddleware.js";
const router = express.Router();

// helper: compute live status
function computeLiveStatus(startIso, endIso) {
    if (!startIso || !endIso) return "upcoming";
    const now = Date.now();
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    if (now < s) return "upcoming";
    if (now >= s && now < e) return "ongoing";
    return "completed";
}

// helper: derive date/time strings (YYYY-MM-DD, HH:mm) from Date
function deriveDateAndTime(d) {
    if (!d) return { startDate: undefined, startTime: undefined };
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return { startDate: undefined, startTime: undefined };

    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = dt.getFullYear();
    const mm = pad(dt.getMonth() + 1);
    const dd = pad(dt.getDate());
    const hh = pad(dt.getHours());
    const min = pad(dt.getMinutes());

    return {
        startDate: `${yyyy}-${mm}-${dd}`,
        startTime: `${hh}:${min}`,
    };
}

router.post("/", protect, async (req, res) => {
    try {
        const { title, duration, startTimestamp, startDate, startTime, targetAudience, institute, author, sections = [], facultyEmail } = req.body;

        console.log("✅ RECEIVED:", { title: title?.slice(0, 30), duration, targetAudience: targetAudience?.slice(0, 30), sections: sections?.length });

        let start = startTimestamp ? new Date(startTimestamp) : new Date(`${startDate}T${startTime}:00`);
        let end = new Date(start.getTime() + Number(duration) * 60000);
        const { startDate: derivedDate, startTime: derivedTime } = deriveDateAndTime(start);

        const testDoc = new Test({
            title,
            duration: Number(duration),
            startTimestamp: start,
            endTimestamp: end,
            startDate: derivedDate,
            startTime: derivedTime,
            targetAudience,
            courseName: targetAudience,
            author,
            institute,
            facultyEmail: facultyEmail || author || "admin@exam.com",
            status: computeLiveStatus(start, end),
            // ✅ FIXED ObjectId GENERATION:
            sections: sections.map((sec, secIdx) => {
                console.log(`🔍 Section ${secIdx}:`, sec.questions.map(q => ({
                    text: q.questionText.slice(0, 30),
                    correctIdx: q.correctIdx,  // ← DEBUG THIS!
                    hasOptions: (q.options || []).length
                })));

                return {
                    name: sec.name || 'General',
                    marks: Number(sec.marks ?? 0),
                    questions: (sec.questions || []).map((q, qIdx) => {
                        const options = (q.options || []).map((opt, optIdx) => ({
                            text: opt.text || opt || `Option ${optIdx + 1}`,
                            _id: new mongoose.Types.ObjectId()
                        }));

                        // ✅ FIXED: Use correctIdx or default 2 (C option)
                        const correctIndex = q.correctIdx !== undefined ? q.correctIdx : 2;
                        console.log(`Q${qIdx}: correctIdx=${q.correctIdx} → using ${correctIndex}`);

                        return {
                            questionText: q.questionText || '',
                            options,
                            correctOptionId: options[correctIndex]?._id || options[0]._id
                        }
                    })
                }
            }),

            totalMarks: sections.reduce((sum, sec) => sum + Number(sec.marks || 0), 0)
        });

        const saved = await testDoc.save();
        res.status(201).json({ success: true, test: saved });
    } catch (error) {
        console.error("SAVE ERROR:", error);
        res.status(500).json({ message: error.message });
    }
});


// List tests with optional filtering; returns liveStatus + serverTime for client sync
router.get("/", protect, async (req, res) => {
    try {
        const { email, status } = req.query;
        const filter = {};
        if (email) filter.facultyEmail = email;
        if (status) filter.status = status;
        const tests = await Test.find(filter).lean();

        const serverTime = new Date().toISOString();
        const enriched = tests.map((t) => ({
            ...t,
            // ensure courseName exists for clients (fallback to targetAudience)
            courseName: t.courseName || t.targetAudience,
            liveStatus: computeLiveStatus(t.startTimestamp, t.endTimestamp),
        }));

        res.json({ serverTime, tests: enriched });
    } catch (error) {
        console.error("Get tests error:", error);
        res.status(500).json({ message: error.message });
    }
});

// Get test by id (with serverTime and liveStatus)
router.get("/:id", protect, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: `Invalid test ID: ${id}` });
        }

        const test = await Test.findById(req.params.id).lean();
        if (!test) return res.status(404).json({ message: "Test not found" });

        const serverTime = new Date().toISOString();
        const enriched = {
            ...test,
            courseName: test.courseName || test.targetAudience,
            liveStatus: computeLiveStatus(test.startTimestamp, test.endTimestamp),
        };

        res.json({ serverTime, test: enriched });
    } catch (error) {
        console.error("Get test by id error:", error);
        res.status(500).json({ message: error.message });
    }
});

// Update test by id (validate passMarks < totalMarks when updated)
router.put("/:id", protect , async (req, res) => {
    try {
        const update = { ...req.body };

        // If client provided courseName but not targetAudience, keep both fields consistent if desired
        if (update.courseName && !update.targetAudience) {
            update.targetAudience = update.courseName;
        } else if (update.targetAudience && !update.courseName) {
            update.courseName = update.targetAudience;
        }

        if (update.passMarks !== undefined && update.totalMarks !== undefined) {
            const pm = Number(update.passMarks);
            const tm = Number(update.totalMarks);
            if (Number.isNaN(pm) || Number.isNaN(tm))
                return res.status(400).json({ message: "Invalid passMarks or totalMarks" });
            if (pm >= tm) return res.status(400).json({ message: "passMarks must be smaller than totalMarks" });
        }

        // handle timestamp/duration updates
        if (update.startTimestamp || update.endTimestamp || update.duration || (update.startDate && update.startTime)) {
            const existing = await Test.findById(req.params.id);
            if (!existing) return res.status(404).json({ message: "Test not found" });

            // determine start (prefer provided values, fall back to existing)
            let start;
            if (update.startTimestamp) {
                start = new Date(update.startTimestamp);
            } else if (update.startDate && update.startTime) {
                start = new Date(`${update.startDate}T${update.startTime}:00`);
            } else {
                start = existing.startTimestamp;
            }
            if (isNaN(new Date(start).getTime())) return res.status(400).json({ message: "Invalid startTimestamp/startDate/startTime" });

            const dur = update.duration !== undefined ? Number(update.duration) : existing.duration;
            if (Number.isNaN(dur) || dur <= 0) return res.status(400).json({ message: "Invalid duration" });

            const end = update.endTimestamp ? new Date(update.endTimestamp) : new Date(new Date(start).getTime() + dur * 60000);
            if (isNaN(new Date(end).getTime())) return res.status(400).json({ message: "Invalid endTimestamp" });

            const now = new Date();
            let newStatus = "upcoming";
            if (now >= start && now < end) newStatus = "ongoing";
            if (now >= end) newStatus = "completed";

            update.startTimestamp = start;
            update.endTimestamp = end;
            update.duration = dur;
            update.status = newStatus;

            const { startDate: derivedDate, startTime: derivedTime } = deriveDateAndTime(start);
            update.startDate = derivedDate;
            update.startTime = derivedTime;
        }

        // ensure courseName if targetAudience changed in update
        if (update.targetAudience && !update.courseName) {
            update.courseName = update.targetAudience;
        }

        const test = await Test.findByIdAndUpdate(req.params.id, update, {
            new: true,
            runValidators: true,
        });

        if (!test) return res.status(404).json({ message: "Test not found" });

        try {
            const io = req.app.get("io");
            if (io) {
                const payload = {
                    ...test.toObject(),
                    courseName: test.courseName || test.targetAudience,
                    liveStatus: computeLiveStatus(test.startTimestamp, test.endTimestamp),
                    serverTime: new Date().toISOString(),
                };

                io.to(`test:${test._id}`).emit("testUpdated", payload);

                const audiences = new Set();
                if (test.targetAudience) {
                    String(test.targetAudience)
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean)
                        .forEach((a) => audiences.add(a));
                }
                if (test.courseName) {
                    String(test.courseName)
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean)
                        .forEach((a) => audiences.add(a));
                }

                audiences.forEach((a) => io.to(`audience:${a}`).emit("testUpdated", payload));
            }
        } catch (e) {
            console.error("Emit error on update:", e);
        }

        res.json(test);
    } catch (error) {
        console.error("Update test error:", error);
        res.status(400).json({ message: error.message });
    }
});

// Delete test by id
router.delete("/:id", protect, async (req, res) => {
    try {
        const test = await Test.findByIdAndDelete(req.params.id);
        if (!test) return res.status(404).json({ message: "Test not found" });

        try {
            const io = req.app.get("io");
            if (io) {
                const payload = { _id: test._id };

                io.to(`test:${test._id}`).emit("testDeleted", payload);

                const audiences = new Set();
                if (test.targetAudience) {
                    String(test.targetAudience)
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean)
                        .forEach((a) => audiences.add(a));
                }
                if (test.courseName) {
                    String(test.courseName)
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean)
                        .forEach((a) => audiences.add(a));
                }

                audiences.forEach((a) => io.to(`audience:${a}`).emit("testDeleted", payload));
            }
        } catch (e) {
            console.error("Emit error on delete:", e);
        }

        res.json({ message: "Test deleted" });
    } catch (error) {
        console.error("Delete test error:", error);
        res.status(500).json({ message: error.message });
    }
});

export default router;
