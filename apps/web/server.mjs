import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

const port = Number(process.env.PORT ?? 8080);
const distRoot = resolve(
  process.env.DIST_DIR ?? new URL("./dist", import.meta.url).pathname,
);
const apiOrigin = new URL(process.env.API_ORIGIN ?? "http://127.0.0.1:3000");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const hiddenHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function addSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
}

async function proxyApi(request, response) {
  const target = new URL(request.url ?? "/", apiOrigin);
  const headers = new Headers(request.headers);
  headers.delete("host");
  const method = request.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : request;
  const upstream = await fetch(target, {
    method,
    headers,
    body,
    duplex: body ? "half" : undefined,
  });
  response.statusCode = upstream.status;
  upstream.headers.forEach((value, name) => {
    if (!hiddenHeaders.has(name.toLowerCase())) response.setHeader(name, value);
  });
  if (request.method === "HEAD" || !upstream.body) return response.end();
  await pipeline(upstream.body, response);
}

const server = createServer(async (request, response) => {
  addSecurityHeaders(response);
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/healthz") {
      response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return response.end("ok");
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
      return await proxyApi(request, response);
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      return response.end();
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400);
      return response.end();
    }
    const candidate = resolve(distRoot, `.${pathname}`);
    const relative = candidate.slice(distRoot.length);
    if (relative.startsWith(sep + "..") || relative === "..") {
      response.writeHead(400);
      return response.end();
    }
    let filePath = candidate;
    try {
      await access(filePath);
    } catch {
      if (extname(pathname)) {
        response.writeHead(404);
        return response.end();
      }
      filePath = resolve(distRoot, "index.html");
    }
    const info = await stat(filePath);
    if (!info.isFile()) {
      response.writeHead(404);
      return response.end();
    }
    response.setHeader(
      "Content-Type",
      contentTypes[extname(filePath)] ?? "application/octet-stream",
    );
    response.setHeader(
      "Cache-Control",
      extname(filePath) === ".html"
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    );
    if (request.method === "HEAD") return response.end();
    await pipeline(createReadStream(filePath), response);
  } catch {
    if (!response.headersSent)
      response.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
    response.end("Service unavailable");
  }
});

await access(distRoot);
server.listen(port, "0.0.0.0");
