import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import { chatRouter } from "./routes/chat.js";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment." },
  });

  app.use("/api", limiter, chatRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));
  app.use(express.static(publicDir));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
      return res.status(400).json({ error: "Invalid request." });
    }
    console.error("Server error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  });

  return app;
}
