import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "faculty"], required: true },
    institute: { type: String, required: true },

    // ✅ Added field for student's course or batch
    branchBatch: {
      type: String,
      required: function () {
        return this.role === "student";
      },
      default: "",
    },
    // ✅ Added for single-device login
    sessionId: {
      type: String,
      default: null,
    },
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    tokenExpiry: Date,

    resetPasswordToken: String,
    resetPasswordExpiry: Date,
  },
  { timestamps: true }
);

// ✅ Optional: hide password when converting to JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model("User", userSchema);
