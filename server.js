const major = Number(process.versions.node.split(".")[0]);
if (major < 18) {
  console.error(
    `Node.js 18 or newer is required (you have ${process.versions.node}). ` +
      "Download the LTS version from https://nodejs.org and try again."
  );
  process.exit(1);
}

const { config } = await import("./src/config.js");
const { createApp } = await import("./src/app.js");

const app = createApp();

// Export the Express app so the host can run it.
// Vercel detects `server.js` and serves it as a serverless function.
export default app;

// Locally, run a normal long-lived server. Vercel sets VERCEL=1, so we only
// listen when the app is started directly (npm start).
if (!process.env.VERCEL) {
  const server = app.listen(config.port, () => {
    const mode = config.mock ? " (mock mode, no API calls)" : "";
    console.log(`Chatbot running at http://localhost:${config.port}${mode}`);
    console.log("Press Ctrl+C to stop.");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use. Set PORT=3001 (or another number) in .env and try again.`);
    } else {
      console.error("Server error:", err.message);
    }
    process.exit(1);
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled error:", reason?.message ?? reason);
});
