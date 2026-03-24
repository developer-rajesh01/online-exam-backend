import Question from "../models/Question.js";
export const bulkAddQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    const results = [];

    for (const q of questions) {
      // Create options array first
      const options = q.options.map(opt => ({ text: opt.trim() }));

      // Create question WITHOUT correctOptionId
      const question = new Question({
        questionText: q.questionText.trim(),
        options: options
      });

      // Save FIRST time - NO validation
      await question.save({ validateBeforeSave: false });

      // Set correct answer (index 0-3)
      const correctIndex = Math.min(Math.max(0, q.correctAnswerIndex), 3);
      question.correctOptionId = question.options[correctIndex]._id;

      // Save SECOND time - NOW validates
      await question.save();

      results.push({
        success: true,
        id: question._id,
        question: question.questionText.substring(0, 50)
      });
    }

    res.json({
      message: `✅ Saved ${results.length} questions!`,
      count: results.length,
      saved: results
    });

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};


// Other functions (add these too)
export const getAllQuestions = async (req, res) => {
  try {
    const questions = await Question.find()
      .populate('correctOptionId', 'text')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ count: questions.length, questions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
