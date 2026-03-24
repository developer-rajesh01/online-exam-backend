// Server.js (ESM)
import "dotenv/config"; // loads .env
import http from "http";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import attemptsRouter from "./routes/attempts.js";

import errorHandler from "./middlewares/errorHandler.js";

import { Server as IOServer } from "socket.io";
import cron from "node-cron";
import updateTestStatuses from "./helpers/statusUpdater.js";
import sendEmail from "./utils/sendEmail.js";
const app = express();
// Simple request logger
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

// Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS config - dynamic origin from env
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://developer-rajesh01.github.io"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
};
app.use(cors(corsOptions));



app.get("/test-email", async (req, res) => {
  try {
    await sendEmail(
      "your_email@gmail.com",
      "Test Email",
      "<h2>Email is working ✅</h2>"
    );

    res.send("Email sent successfully");
  } catch (err) {
    console.log(err);
    res.send("Error sending email");
  }
});
// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || "development"
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("✅ Online Examination System API is running...");
});

// Mount routers (FIXED ORDER: most specific first)
app.use("/api/auth", authRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/tests", testRoutes);        // tests before attempts
app.use("/api/attempts", attemptsRouter); // specific attempts path

// 404 for unmatched API routes
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

// Global error handler (must be last)
app.use(errorHandler);

const server = http.createServer(app);

const io = new IOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("joinTest", (testId) => {
    if (!testId) {
      socket.emit("error", { message: "Test ID required" });
      return;
    }
    socket.join(`test:${testId}`);
    console.log(`Socket ${socket.id} joined test:${testId}`);
    socket.emit("joinedTest", { testId });
  });

  socket.on("joinAudience", (aud) => {
    if (!aud) {
      socket.emit("error", { message: "Audience ID required" });
      return;
    }
    const tokens = String(aud).split(",").map(t => t.trim()).filter(Boolean);
    tokens.forEach(t => {
      socket.join(`audience:${t}`);
      console.log(`Socket ${socket.id} joined audience:${t}`);
    });
    socket.emit("joinedAudience", { audiences: tokens });
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", socket.id, reason);
  });
});

app.set("io", io);

const PORT = process.env.PORT || 8080;

// Start server only after DB connection
const startServer = async () => {

  try {

    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
    // server.listen(PORT, () => {

    //   console.log(`🚀 Server running on port ${PORT}`);
    //   console.log(`📊 Health check: http://localhost:${PORT}/api/health`);

    //   console.log("⏰ Status updater cron scheduled every minute");

    //   cron.schedule("*/1 * * * *", async () => {
    //     try {
    //       await updateTestStatuses(io, { emitWindowMinutes: 5 });
    //     } catch (err) {
    //       console.error("Cron status updater error:", err.message);
    //     }
    //   });

    // });

  } catch (error) {

    console.error("Server startup failed:", error);

  }

};

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Closing server gracefully...`);
  io.close(() => {
    console.log("Socket.IO server closed.");
  });
  server.close((err) => {
    if (err) {
      console.error("Server close error:", err);
      process.exit(1);
    }
    console.log("HTTP server closed.");
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => {
    console.error("Force closing server...");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
