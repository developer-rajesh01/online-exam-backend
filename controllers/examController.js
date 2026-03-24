import Exam from "../models/Exam.js";

// ✅ Create Exam (Admin only)
export const createExam = async (req, res) => {
  try {
    const { title, subject, totalMarks, duration } = req.body;

    const exam = await Exam.create({
      title,
      subject,
      totalMarks,
      duration,
      createdBy: req.user._id,
    });

    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get All Exams
export const getExams = async (req, res) => {
  try {
    const exams = await Exam.find().populate("createdBy", "name email");
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get Exam by ID
export const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update Exam
export const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    exam.title = req.body.title || exam.title;
    exam.subject = req.body.subject || exam.subject;
    exam.totalMarks = req.body.totalMarks || exam.totalMarks;
    exam.duration = req.body.duration || exam.duration;

    const updatedExam = await exam.save();
    res.json(updatedExam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Delete Exam
export const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    await exam.deleteOne();
    res.json({ message: "Exam deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
