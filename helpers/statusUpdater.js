// helpers/statusUpdater.js
import Test from "../models/Test.js";

/**
 * Automatically updates test statuses and emits socket events if io is provided.
 * - Marks tests as ongoing when start time arrives.
 * - Marks tests as completed when end time passes.
 */
export default async function updateTestStatuses(io, opts = {}) {
    const now = new Date();
    const emitWindowMinutes = opts.emitWindowMinutes || 5;
    const windowStart = new Date(now.getTime() - emitWindowMinutes * 60_000);

    try {
        // 1️⃣  Mark tests as ongoing
        const startedRes = await Test.updateMany(
            { startTimestamp: { $lte: now }, endTimestamp: { $gt: now }, status: { $ne: "ongoing" } },
            { $set: { status: "ongoing" } }
        );

        // 2️⃣  Mark tests as completed
        const completedRes = await Test.updateMany(
            { endTimestamp: { $lte: now }, status: { $ne: "completed" } },
            { $set: { status: "completed" } }
        );

        const startedCount = startedRes.modifiedCount ?? startedRes.nModified ?? 0;
        const completedCount = completedRes.modifiedCount ?? completedRes.nModified ?? 0;

        if (startedCount > 0 || completedCount > 0) {
            console.log(`[statusUpdater] ${now.toISOString()} — started:${startedCount}, completed:${completedCount}`);
        }

        // 3️⃣  If io is passed, emit real-time updates
        if (io && (startedCount > 0 || completedCount > 0)) {
            const startedTests = startedCount > 0
                ? await Test.find({
                    startTimestamp: { $lte: now },
                    endTimestamp: { $gt: now },
                    status: "ongoing",
                    $or: [{ startTimestamp: { $gte: windowStart } }, { endTimestamp: { $gte: windowStart } }],
                }).lean()
                : [];

            const completedTests = completedCount > 0
                ? await Test.find({
                    endTimestamp: { $lte: now, $gte: windowStart },
                    status: "completed",
                }).lean()
                : [];

            const emitForTest = (t) => {
                const payload = {
                    testId: t._id,
                    title: t.title,
                    status: t.status,
                    startTimestamp: t.startTimestamp,
                    endTimestamp: t.endTimestamp,
                };

                // emit to test room
                io.to(`test:${t._id}`).emit("testStatusChanged", payload);

                // emit to audience rooms
                if (t.targetAudience) {
                    String(t.targetAudience)
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean)
                        .forEach((a) => io.to(`audience:${a}`).emit("testStatusChanged", payload));
                }
            };

            startedTests.forEach(emitForTest);
            completedTests.forEach(emitForTest);
        }

        return { startedCount, completedCount };
    } catch (err) {
        console.error("[statusUpdater] error:", err);
    }
}
