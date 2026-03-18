import express from "express";
import { createServer as createViteServer } from "vite";
import analyzeHandler from "./api/analyze.js";
import wordsHandler from "./api/words.js";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' })); // For large base64 images

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasApiKey: !!process.env.API_KEY,
      geminiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
      apiKeyLength: process.env.API_KEY ? process.env.API_KEY.length : 0,
      geminiKeyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 4) : ""
    });
  });

  app.all("/api/analyze", async (req, res) => {
    await analyzeHandler(req, res);
  });

  app.all("/api/words", async (req, res) => {
    await wordsHandler(req, res);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
