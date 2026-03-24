import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";
import { v4 as uuidv4 } from "uuid";


/**
 * Register a new user.
 * Expects JSON body:
 * { name, email, password, role, institute, branchBatch? }
 * - branchBatch is required when role === "student"
 */
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, institute, branchBatch } = req.body;

    // basic validation
    if (!name || !email || !password || !role || !institute) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["student", "faculty"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'student' or 'faculty'." });
    }

    // if student, branchBatch must be provided
    if (role === "student" && (!branchBatch || !String(branchBatch).trim())) {
      return res.status(400).json({ message: "branchBatch is required for students" });
    }

    // Check if user already exists by email
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");

    // Create user with token
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      institute: institute.trim(),
      branchBatch: role === "student" ? String(branchBatch).trim() : "",
      verificationToken: token,
      tokenExpiry: Date.now() + 3600000,
    });

    // ✅ Send email in background
    const link = `${process.env.FRONTEND_URL}/#/verify-email/${token}`;
    sendEmail(
      newUser.email,
      "Verify Your Email - Online Examination System",
      `
  <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
    
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: #2c3e50; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Online Examination System</h2>
      </div>

      <!-- Body -->
      <div style="padding: 30px; text-align: center;">
        <h3 style="color: #333;">Welcome, ${newUser.name} 👋</h3>
        
        <p style="color: #555; font-size: 16px;">
          Thank you for registering. Please verify your email address to continue.
        </p>

        <!-- Button -->
        <a href="${link}" 
           style="display: inline-block; margin-top: 20px; padding: 12px 25px; background: #27ae60; color: #fff; text-decoration: none; border-radius: 5px; font-size: 16px;">
           Verify Email
        </a>

        <p style="margin-top: 20px; color: #888; font-size: 14px;">
          If you did not create this account, you can ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #ecf0f1; padding: 15px; text-align: center; font-size: 12px; color: #777;">
        © ${new Date().getFullYear()} Online Examination System <br/>
        Secure & Reliable Testing Platform
      </div>

    </div>

  </div>
  `
    ).catch(err => console.log("Email error:", err));
    // Prepare returned user (omit password)
    // ✅ Send response (no return yet)
    res.status(201).json({
      message: "Registration successful. Please check your email."
    });

    // ✅ Save only once
    await newUser.save();

    

    const userResponse = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      institute: newUser.institute,
      branchBatch: newUser.branchBatch || "",
      createdAt: newUser.createdAt,
    };

  } catch (error) {
    console.error("registerUser error:", error);
    // handle duplicate-key error more clearly
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(409).json({ message: "Email already registered" });
    }
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};
export const logoutUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    user.sessionId = null;
    await user.save();

    res.json({ message: "Logged out successfully" });

  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
};
/**
 * Login a user.
 * Expects JSON body: { email, password }
 * Returns { message, token, user }
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password, forceLogin } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!user.isVerified) {
      return res.status(401).json({
        message: "Please verify your email first",
        allowResend: true,
        email: user.email
      });
    }
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    if (user.sessionId && !forceLogin) {
      return res.status(409).json({
        message: "Already logged in on another device",
        allowForceLogin: true
      });

    }
    // Create new session for this login
    const newSessionId = uuidv4();
    user.sessionId = newSessionId;
    await user.save();
    // Build JWT payload (include useful user info)
    const jwtPayload = {
      id: user._id,
      role: user.role,
      sessionId: newSessionId,
      institute: user.institute,
      branchBatch: user.branchBatch || "",
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

    // Return user data (without password)
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      institute: user.institute,
      branchBatch: user.branchBatch || "",
    };

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("loginUser error:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.json({ message: "If email exists, reset link sent" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = Date.now() + 15 * 60 * 1000;

    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/#/reset-password/${resetToken}`;

    await sendEmail(
      user.email,
      "Reset Your Password - Online Examination System",
      `
  <div style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, sans-serif;">
    
    <div style="max-width:600px; margin:30px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding:25px; text-align:center; color:white;">
        
        <!-- LOGO -->
        <img src="https://via.placeholder.com/80" alt="Logo" style="width:80px; margin-bottom:10px;" />
        
        <h2 style="margin:0; font-size:22px;">Online Examination System</h2>
        <p style="margin:5px 0 0; font-size:14px;">Secure & Smart Testing Platform</p>
      </div>

      <!-- Body -->
      <div style="padding:30px; text-align:center;">
        
        <h3 style="color:#333; margin-bottom:10px;">Reset Your Password 🔐</h3>

        <p style="color:#555; font-size:15px; line-height:1.6;">
          We received a request to reset your password.  
          Click the button below to set a new one.
        </p>

        <!-- Button -->
        <a href="${resetLink}" 
           style="display:inline-block; margin-top:20px; padding:14px 28px; background:#4f46e5; color:#fff; text-decoration:none; border-radius:8px; font-size:16px; font-weight:bold; box-shadow:0 4px 10px rgba(79,70,229,0.3);">
           Reset Password
        </a>

        <p style="margin-top:20px; font-size:14px; color:#777;">
          This link will expire in <strong>15 minutes</strong>.
        </p>

        <!-- Divider -->
        <hr style="margin:25px 0; border:none; border-top:1px solid #eee;" />

        <!-- Fallback -->
        <p style="font-size:12px; color:#999;">
          If the button doesn't work, copy & paste this link:<br/>
          <span style="color:#4f46e5;">${resetLink}</span>
        </p>

        <p style="margin-top:15px; font-size:13px; color:#999;">
          If you didn’t request this, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f1f5f9; padding:15px; text-align:center; font-size:12px; color:#666;">
        © ${new Date().getFullYear()} Online Examination System <br/>
        All rights reserved.
      </div>

    </div>

  </div>
  `
    );

    res.json({ message: "Reset link sent to email" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });

  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ If already verified
    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // ✅ Generate new token
    const token = crypto.randomBytes(32).toString("hex");

    user.verificationToken = token;
    user.tokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const link = `${process.env.FRONTEND_URL}/#/verify-email/${token}`;

    await sendEmail(
      user.email,
      "Resend Verification - Online Examination System",
      `
      <h2>Hello ${user.name}</h2>
      <p>Click below to verify your email:</p>
      <a href="${link}">Verify Email</a>
      `
    );

    res.json({ message: "Verification email resent successfully" });

  } catch (error) {
    console.error("resendVerificationEmail error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};