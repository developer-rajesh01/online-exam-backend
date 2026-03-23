import express from "express";
import { registerUser, loginUser, logoutUser } from "../controllers/authController.js";
import protect from "../middlewares/authMiddleware.js";
import User from "../models/User.js";
import { forgotPassword, resetPassword } from "../controllers/authController.js";


const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", protect, logoutUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.get("/verify-email/:token", async (req, res) => {
    const user = await User.findOne({
        verificationToken: req.params.token,
        tokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
        return res.status(400).send("Invalid or expired token");
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.tokenExpiry = null;

    await user.save();

    res.send("Email verified successfully ✅");
});

export default router;