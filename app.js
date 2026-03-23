import express from "express";
import cors from "cors";

// import routes
import questionRoutes from "./routes/questionRoutes.js";

const app = express();

app.use(cors());
app.use(express.json()); // important for POST body parsing

// test root
app.get("/", (req, res) => res.json({ message: "Backend is running" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "Server is running",
    time: new Date(),
  });
});
// mount routes
app.use("/api/questions", questionRoutes);

// generic 404 for unknown API routes (helps debugging)
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

export default app;
