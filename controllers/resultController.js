import Result from "../models/Result.js";

// ✅ Save Exam Result
export const saveResult = async (req, res) => {
  try {
    const { exam, score } = req.body;
    const result = await Result.create({
      user: req.user._id,
      exam,
      score,
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get All Results of a User
export const getUserResults = async (req, res) => {
  try {
    const results = await Result.find({ user: req.user._id }).populate(
      "exam",
      "title subject"
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get All Results (Admin)
export const getAllResults = async (req, res) => {
  try {
    const results = await Result.find()
      .populate("user", "name email")
      .populate("exam", "title");
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
