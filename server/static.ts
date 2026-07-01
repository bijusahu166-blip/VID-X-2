import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  const policyPath = path.resolve(process.cwd(), "policy-content.html");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.get("/privacy-policy.html", (_req, res) => {
    if (fs.existsSync(policyPath)) {
      res.sendFile(policyPath);
      return;
    }

    res.status(404).send("Privacy policy not found");
  });

  // fall through to index.html for GET requests if the file doesn't exist
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
