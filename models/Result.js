import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  exam: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Exam" 
},
  score: { 
    type: Number, 
    required: true 
},
  date: { 
    type: Date, 
    default: Date.now
},
});

export default mongoose.model("Result", resultSchema);
