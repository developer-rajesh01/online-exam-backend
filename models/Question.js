import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true }
});

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{
    type: optionSchema
  }],
  correctOptionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false  // ← THIS MUST BE FALSE
  }
}, { timestamps: true });

const Question = mongoose.model("Question", questionSchema);
export default Question;
