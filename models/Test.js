// models/Test.js
import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
    {
        text: { type: String, required: true },
    },
    { _id: true } // Mongo auto-generates _id
);

const questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },

    options: {
        type: [optionSchema],
        validate: [(arr) => arr.length >= 2, "At least 2 options required"],
    },

    correctOptionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
});

// ADD THIS NEW SCHEMA - after questionSchema
const sectionSchema = new mongoose.Schema({
    name: { type: String, required: true, default: 'General' },
    marks: { type: Number, required: true },
    questions: [questionSchema],
}, { _id: false });  // No _id needed for embedded sections

// small helper to pad numbers
function pad(n) {
    return String(n).padStart(2, "0");
}

// derive YYYY-MM-DD and HH:mm from a Date
function deriveDateAndTime(d) {
    if (!d) return {};
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return {};
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

const testSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        duration: { type: Number, required: true }, // in minutes
        // allow startTimestamp/endTimestamp to be optional so server logic can compute them
        startTimestamp: { type: Date },
        endTimestamp: { type: Date },

        // keep targetAudience for backward compatibility
        targetAudience: { type: String, required: true },

        // canonical field for frontend: courseName (populated from targetAudience if missing)
        courseName: { type: String, index: true },

        // derived user-friendly date/time strings
        startDate: { type: String },
        startTime: { type: String },

        author: { type: String, required: true },
        passMarks: { type: Number },
        totalMarks: { type: Number, required: false },
        institute: { type: String, required: true },
        sections: [sectionSchema],  // ✅ Nested sections with points
        facultyEmail: { type: String, required: true },
        status: {
            type: String,
            enum: ["upcoming", "ongoing", "completed"],
            default: "upcoming",
            index: true,
        },
    },
    { timestamps: true }
);

// indexes
testSchema.index({ startTimestamp: 1 });
testSchema.index({ endTimestamp: 1 });
testSchema.index({ institute: 1, courseName: 1 });
testSchema.index({ institute: 1, targetAudience: 1 });

// pre-validate hook: ensure courseName, derive startDate/startTime, compute endTimestamp and status
testSchema.pre("validate", function (next) {
    try {
        // ensure courseName is present (copy from targetAudience if needed)
        if (!this.courseName && this.targetAudience) {
            this.courseName = this.targetAudience;
        }

        // If startTimestamp exists and startDate/startTime missing -> derive them
        if ((this.startTimestamp || this.startDate) && (!this.startDate || !this.startTime)) {
            if (this.startTimestamp) {
                const derived = deriveDateAndTime(this.startTimestamp);
                if (derived.startDate) this.startDate = derived.startDate;
                if (derived.startTime) this.startTime = derived.startTime;
            }
        }

        // compute endTimestamp from duration + startTimestamp when endTimestamp missing
        if (!this.endTimestamp && this.startTimestamp && typeof this.duration === "number") {
            this.endTimestamp = new Date(this.startTimestamp.getTime() + this.duration * 60000);
        }

        // If startTimestamp missing but startDate + startTime present, attempt to build startTimestamp (assumes local timezone)
        if (!this.startTimestamp && this.startDate && this.startTime) {
            const isoLocal = `${this.startDate}T${this.startTime}:00`;
            const dt = new Date(isoLocal);
            if (!isNaN(dt.getTime())) {
                this.startTimestamp = dt;
                // if endTimestamp missing and duration present, compute endTimestamp
                if (!this.endTimestamp && typeof this.duration === "number") {
                    this.endTimestamp = new Date(this.startTimestamp.getTime() + this.duration * 60000);
                }
            }
        }

        // compute status if we have timestamps
        if (this.startTimestamp && this.endTimestamp) {
            const now = Date.now();
            const s = new Date(this.startTimestamp).getTime();
            const e = new Date(this.endTimestamp).getTime();
            if (now < s) this.status = "upcoming";
            else if (now >= s && now < e) this.status = "ongoing";
            else this.status = "completed";
        }

        next();
    } catch (err) {
        next(err);
    }
});

// optional virtual for liveStatus (if you want to include it in responses)
// Note: virtuals are not included in .toObject() by default unless configured; your routes may compute liveStatus separately.
testSchema.virtual("liveStatus").get(function () {
    if (!this.startTimestamp || !this.endTimestamp) return "upcoming";
    const now = Date.now();
    const s = new Date(this.startTimestamp).getTime();
    const e = new Date(this.endTimestamp).getTime();
    if (now < s) return "upcoming";
    if (now >= s && now < e) return "ongoing";
    return "completed";
});

const Test = mongoose.model("Test", testSchema);
export default Test;
