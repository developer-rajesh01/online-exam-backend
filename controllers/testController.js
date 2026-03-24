// controllers/testController.js
import Test from "../models/Test.js";

/**
 * Create a test.
 * Accepts either:
 *  - startTimestamp (ISO string) OR
 *  - startDate (YYYY-MM-DD) and startTime (HH:MM)
 *
 * Calculates endTimestamp = startTimestamp + duration (minutes).
 */
export const createTest = async (req, res, next) => {
    try {
        const {
            title,
            duration, // minutes
            startTimestamp, // optional ISO
            startDate, // optional YYYY-MM-DD
            startTime, // optional HH:MM
            targetAudience,
            author,
            passMarks,
            totalMarks,
            institute,
            sections = [],  // ✅ Changed from questions
            facultyEmail
        } = req.body;

        console.log("🔍 Frontend payload:", {
            title: title,
            duration: duration,
            startTimestamp: startTimestamp,
            startDate: startDate,
            startTime: startTime,
            targetAudience: targetAudience
        });
        // Basic validation
        if (!title || !duration || (!startTimestamp && !(startDate && startTime)) || !targetAudience) {
            return res.status(400).json({ message: "Missing required fields: title, duration, startTimestamp OR (startDate+startTime), totalMarks, targetAudience" });
        }

        // compute start timestamp (prefer explicit startTimestamp)
        let start;
        if (startTimestamp) {
            start = new Date(startTimestamp);
            if (isNaN(start)) return res.status(400).json({ message: "Invalid startTimestamp" });
        } else {
            // build from startDate and startTime (local)
            const iso = `${startDate}T${startTime}:00`;
            start = new Date(iso);
            if (isNaN(start)) return res.status(400).json({ message: "Invalid startDate/startTime" });
        }

        // compute end timestamp
        const dur = Number(duration);
        if (Number.isNaN(dur) || dur <= 0) return res.status(400).json({ message: "Invalid duration" });

        const end = new Date(start.getTime() + dur * 60_000);

        // passMarks validation (if provided)
        if (passMarks !== undefined && passMarks !== null) {
            const pm = Number(passMarks);
            const tm = Number(totalMarks);
            if (Number.isNaN(pm) || Number.isNaN(tm)) return res.status(400).json({ message: "Invalid passMarks/totalMarks" });
            if (pm >= tm) return res.status(400).json({ message: "passMarks must be smaller than totalMarks" });
        }

        // build test doc
        const test = new Test({
            title,
            duration: dur,
            startTimestamp: start,
            endTimestamp: end,
            author,
            passMarks: passMarks !== undefined ? Number(passMarks) : undefined,
            totalMarks: sections.reduce((sum, sec) => sum + Number(sec.marks || 10), 0) || 10,
            institute,
            sections: sections.length ? sections.map(sec => ({
                name: sec.name || 'General',
                marks: Number(sec.marks || 10),  // ✅ Your format: marks
                questions: (sec.questions || []).map(q => ({
                    questionText: q.questionText || '',
                    options: (q.options || []).map(opt => ({ text: opt.text || opt })),
                    correctIdx: q.correctIdx || 0
                }))
            })) : [{ name: 'General', marks: 10, questions: [] }],
            courseName: courseName || targetAudience,
            facultyEmail,
            status: (new Date() < start) ? "upcoming" : (new Date() >= start && new Date() < end) ? "ongoing" : "completed"
        });

        await test.save();

        // Emit to socket rooms if io available
        try {
            const io = req.app.get("io");
            if (io) {
                const payload = {
                    testId: test._id,
                    title: test.title,
                    startTimestamp: test.startTimestamp,
                    endTimestamp: test.endTimestamp,
                    targetAudience: test.targetAudience || test.courseName,
                };

                // emit to audience rooms
                if (test.targetAudience) {
                    const auds = String(test.targetAudience).split(",").map(a => a.trim()).filter(Boolean);
                    auds.forEach(a => io.to(`audience:${a}`).emit("testCreated", payload));
                }

                // emit to specific test room
                io.to(`test:${test._id}`).emit("testCreated", payload);
            }
        } catch (emitErr) {
            console.error("Emit error in createTest:", emitErr);
        }

        return res.status(201).json({ success: true, test });
    } catch (err) {
        next(err);
    }
};
