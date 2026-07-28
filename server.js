/* ============================================================
   HK Technologies CMS — server
   - Serves the public website (public/index.html)
   - Serves the CMS admin panel (public/admin.html)
   - Exposes a JSON API backed by Supabase (Postgres)
   ============================================================ */

require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { supabase, getSetting, setSetting, getAllSettings, seed } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Behind cPanel/Passenger (one proxy hop) so req.ip is the real client IP.
app.set("trust proxy", 1);
// Don't advertise the framework (A05 — reduce fingerprinting).
app.disable("x-powered-by");

// ---------- Security headers (A05) ----------
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  // Only sent over HTTPS-terminated requests; browsers ignore it over plain HTTP.
  res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  res.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
    ].join("; ")
  );
  next();
});

app.use(express.json({ limit: "2mb" }));

// ---------- Image uploads ----------
const uploadDir = path.join(__dirname, "public", "assets", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// Allow only raster image types by BOTH extension and MIME (A03 — prevents
// uploading .html/.svg/.php that would be served back as active content / XSS).
// SVG is intentionally excluded: it can carry inline <script>.
const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const ALLOWED_IMAGE_MIME = /^image\/(jpeg|png|gif|webp|avif)$/;

// Buffer the upload in memory and validate BEFORE writing to disk, so a rejected
// file never lands in the web-served folder and the client always gets a clean
// JSON error (rejecting mid-stream would otherwise reset the connection).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }, // 8 MB, single file
});

// ---------- Simple token auth ----------
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // tokens are valid for 7 days
const sessions = new Map(); // token -> expiry timestamp (ms)

function getToken(req) {
  return (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

function issueToken() {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  const expiry = token ? sessions.get(token) : undefined;
  if (expiry && expiry > Date.now()) return next();
  if (token) sessions.delete(token); // drop expired / unknown tokens
  return res.status(401).json({ error: "Unauthorized" });
}

// Evict expired tokens hourly so `sessions` can't grow without bound.
// .unref() lets the process exit even while this timer is pending.
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of sessions) if (expiry <= now) sessions.delete(token);
}, 60 * 60 * 1000).unref();

// ---------- Password hashing (A02 — scrypt, built-in, no deps) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

// Verifies against a stored value. Supports hashed ("scrypt$salt$hash") values
// and legacy plaintext (so existing installs keep working until the password
// is changed, at which point it is stored hashed). Constant-time comparison.
function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored) return false;
  let expected;
  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    if (!salt || !hash) return false;
    expected = hash;
    password = crypto.scryptSync(String(password), salt, 64).toString("hex");
  } else {
    expected = stored; // legacy plaintext
    password = String(password);
  }
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Login rate limiting (A04/A07 — per client IP) ----------
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map(); // ip -> { count, resetAt }

function loginRateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec || rec.resetAt <= now) rec = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  rec.count++;
  loginAttempts.set(ip, rec);
  if (rec.count > LOGIN_MAX_ATTEMPTS) {
    res.set("Retry-After", String(Math.ceil((rec.resetAt - now) / 1000)));
    return res.status(429).json({ error: "Too many attempts. Please try again later." });
  }
  next();
}

// Clear the counter after a successful login so honest users aren't throttled.
function clearLoginAttempts(req) {
  loginAttempts.delete(req.ip || "unknown");
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) if (rec.resetAt <= now) loginAttempts.delete(ip);
}, 60 * 60 * 1000).unref();

// Route async errors to the central error handler (A05 — no message leakage).
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.post(
  "/api/login",
  loginRateLimit,
  wrap(async (req, res) => {
    const admin = (await getSetting("admin")) || { password: "admin123" };
    if (req.body && verifyPassword(req.body.password || "", admin.password)) {
      clearLoginAttempts(req);
      return res.json({ token: issueToken() });
    }
    return res.status(401).json({ error: "Wrong password" });
  })
);

app.post("/api/logout", requireAuth, (req, res) => {
  sessions.delete(getToken(req));
  res.json({ ok: true });
});

app.post(
  "/api/change-password",
  requireAuth,
  wrap(async (req, res) => {
    const { password } = req.body || {};
    if (!password || String(password).length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    await setSetting("admin", { password: hashPassword(password) });
    res.json({ ok: true });
  })
);

// ============================================================
//  PUBLIC content endpoint (everything the website needs)
// ============================================================
async function buildContent() {
  const settings = await getAllSettings();
  delete settings.admin; // never expose the password

  const [{ data: products }, { data: services }, { data: testimonials }] = await Promise.all([
    supabase.from("products").select("*").order("sort").order("id"),
    supabase.from("services").select("*").order("sort").order("id"),
    supabase.from("testimonials").select("*").order("sort").order("id"),
  ]);

  return {
    settings,
    products: products || [],
    services: services || [],
    testimonials: testimonials || [],
  };
}

app.get(
  "/api/content",
  wrap(async (req, res) => res.json(await buildContent()))
);

// ============================================================
//  ADMIN — settings (singletons)
// ============================================================
app.get(
  "/api/settings",
  requireAuth,
  wrap(async (req, res) => {
    const all = await getAllSettings();
    delete all.admin;
    res.json(all);
  })
);

app.put(
  "/api/settings/:key",
  requireAuth,
  wrap(async (req, res) => {
    if (req.params.key === "admin")
      return res.status(400).json({ error: "Use /api/change-password instead." });
    await setSetting(req.params.key, req.body);
    res.json({ ok: true });
  })
);

// ============================================================
//  ADMIN — image upload
//  NOTE: must be registered BEFORE the generic "/api/:type"
//  routes below, otherwise POST /api/upload is captured by the
//  collection handler (type="upload") and 404s as "Unknown collection".
// ============================================================
app.post(
  "/api/upload",
  requireAuth,
  upload.single("image"),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_MIME.test(req.file.mimetype) || !ALLOWED_IMAGE_EXT.has(ext)) {
      return res
        .status(400)
        .json({ error: "Only image files are allowed (jpg, png, gif, webp, avif)." });
    }
    const safe = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filename = `${Date.now()}-${safe}`;
    await fs.promises.writeFile(path.join(uploadDir, filename), req.file.buffer);
    res.json({ url: `/assets/uploads/${filename}` });
  })
);

// ============================================================
//  ADMIN — collections (products / services / testimonials)
// ============================================================
const collections = {
  products: { table: "products", fields: ["name", "tag", "descr", "features", "href", "cta", "image", "sort"] },
  services: { table: "services", fields: ["title", "descr", "icon", "sort"] },
  testimonials: { table: "testimonials", fields: ["quote", "author", "role", "sort"] },
};

function pick(body, cfg) {
  const obj = {};
  for (const f of cfg.fields) {
    let v = body[f];
    if (f === "sort") v = Number(v) || 0;
    else if (f === "features") v = Array.isArray(v) ? v : [];
    else if (v === undefined) v = null;
    obj[f] = v;
  }
  return obj;
}

// list
app.get(
  "/api/:type",
  requireAuth,
  wrap(async (req, res) => {
    const cfg = collections[req.params.type];
    if (!cfg) return res.status(404).json({ error: "Unknown collection" });
    const { data, error } = await supabase
      .from(cfg.table)
      .select("*")
      .order("sort")
      .order("id");
    if (error) throw error;
    res.json(data || []);
  })
);

// create
app.post(
  "/api/:type",
  requireAuth,
  wrap(async (req, res) => {
    const cfg = collections[req.params.type];
    if (!cfg) return res.status(404).json({ error: "Unknown collection" });
    const { data, error } = await supabase
      .from(cfg.table)
      .insert(pick(req.body, cfg))
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  })
);

// update
app.put(
  "/api/:type/:id",
  requireAuth,
  wrap(async (req, res) => {
    const cfg = collections[req.params.type];
    if (!cfg) return res.status(404).json({ error: "Unknown collection" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { data, error } = await supabase
      .from(cfg.table)
      .update(pick(req.body, cfg))
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  })
);

// delete
app.delete(
  "/api/:type/:id",
  requireAuth,
  wrap(async (req, res) => {
    const cfg = collections[req.params.type];
    if (!cfg) return res.status(404).json({ error: "Unknown collection" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { error } = await supabase.from(cfg.table).delete().eq("id", id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// ============================================================
//  Static files (public website + admin panel)
// ============================================================
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
//  Central error handler (A05 — friendly messages, no internal leakage)
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Image too large (max 8 MB)." : "Upload error.";
    return res.status(400).json({ error: msg });
  }
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// ---------- Start ----------
seed()
  .catch((e) => console.error("Seed error:", e.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`\n  HK Technologies CMS is running!`);
      console.log(`  ▸ Website:  http://localhost:${PORT}/`);
      console.log(`  ▸ Admin:    http://localhost:${PORT}/admin.html\n`);
    });
  });
