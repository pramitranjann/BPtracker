import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDataStore, getStorageMode, normalizeReading, readReadings, writeReading } from "./lib/store.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, ".env.local"));
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json"
};

await ensureDataStore();

createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

    if (requestUrl.pathname === "/api/health" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        storage: getStorageMode()
      });
      return;
    }

    if (requestUrl.pathname === "/api/readings" && req.method === "GET") {
      sendJson(res, 200, { readings: await readReadings() });
      return;
    }

    if (requestUrl.pathname === "/api/readings" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const reading = await writeReading(normalizeReading(body));
      sendJson(res, 201, { reading });
      return;
    }

    serveStaticAsset(requestUrl.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}).listen(port, () => {
  console.log(`BP tracker available at http://127.0.0.1:${port}`);
});

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function serveStaticAsset(urlPath, res) {
  const cleanPath = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const target = cleanPath === "/" ? "index.html" : cleanPath.slice(1);
  const filePath = join(root, target);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });

  createReadStream(filePath).pipe(res);
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(`${JSON.stringify(body)}\n`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
