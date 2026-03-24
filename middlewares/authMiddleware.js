import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {

  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {

    try {

      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // 🔴 IMPORTANT: Check sessionId
      if (user.sessionId !== decoded.sessionId) {
        return res.status(401).json({
          message: "Session expired. You logged in from another device."
        });
      }

      req.user = user;
      console.log("Token session:", decoded.sessionId);
      console.log("DB session:", user.sessionId);

      next();

    } catch (error) {

      return res.status(401).json({ message: "Not authorized, token failed" });

    }
  }

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

};

export default protect;