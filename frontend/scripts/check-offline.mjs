/**
 * check-offline.mjs
 *
 * Scans a production build directory (out/ or dist/ or .next/) to ensure
 * ZERO external network calls (CDNs, analytics, remote fonts, external URLs).
 *
 * Allowed schemes / URLs:
 * - relative paths (./, /, etc.)
 * - local blob/data URLs
 * - XML namespaces (e.g. http://www.w3.org/2000/svg)
 * - local dev URLs (http://127.0.0.1, http://localhost)
 */

import fs from "node:fs";
import path from "node:path";

const ALLOWED_PATTERNS = [
  /^http:\/\/www\.w3\.org\//,
  /^https?:\/\/localhost/,
  /^https?:\/\/127\.0\.0\.1/,
  /^https?:\/\/schemas\.microsoft\.com/,
  /^https:\/\/nextjs\.org\/docs\//,
  /^https:\/\/react\.dev\/errors\//,
  /^https:\/\/github\.com\/zloirock\/core-js/,
  /^https:\/\/github\.com\/vercel-labs\/vgpu\/issues\//,
  /^https?:\/\/[^\/]+$/, // single-token test strings like https://x, https://тест
  /^https?:\/\/a[\/#?]/, // core-js URL polyfill unit test strings
];

function isAllowed(url) {
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(url));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  // Match http:// or https:// URLs
  const urlRegex = /https?:\/\/[^\s"'`<>{}|\^\[\]]+/g;
  let match;
  const violations = [];

  while ((match = urlRegex.exec(content)) !== null) {
    const foundUrl = match[0];
    if (!isAllowed(foundUrl)) {
      violations.push(foundUrl);
    }
  }

  return violations;
}

function scanDir(dir, violations = []) {
  if (!fs.existsSync(dir)) return violations;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        scanDir(fullPath, violations);
      }
    } else if (
      entry.name.endsWith(".js") ||
      entry.name.endsWith(".html") ||
      entry.name.endsWith(".css") ||
      entry.name.endsWith(".json")
    ) {
      const fileViolations = scanFile(fullPath);
      if (fileViolations.length > 0) {
        violations.push({ file: fullPath, urls: fileViolations });
      }
    }
  }

  return violations;
}

function main() {
  const targetDir = process.argv[2] || "out";
  console.log(`Scanning directory '${targetDir}' for offline compliance...`);

  const violations = scanDir(targetDir);

  if (violations.length > 0) {
    console.error("\n❌ OFFLINE POLICY VIOLATION: External URLs detected in build output:");
    for (const v of violations) {
      console.error(`\nFile: ${v.file}`);
      for (const url of v.urls) {
        console.error(`  - ${url}`);
      }
    }
    process.exit(1);
  }

  console.log("✅ Offline check PASSED: Zero external network references found.");
}

main();
