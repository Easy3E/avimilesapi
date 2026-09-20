import crypto from "crypto";

const supabaseUrl = () => String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseKey = () => process.env.SUPABASE_SERVICE_KEY || "";
export const workerSecret = () => process.env.AVIMILES_FLIGHT_BRIDGE_SECRET || "";

function requireSupabase() {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return { url, key };
}

export async function supabase(path, options = {}) {
  const { url, key } = requireSupabase();
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await r.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = text; }
  }

  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return data;
}

function encryptionKey() {
  const secret = process.env.BRIDGE_ENCRYPTION_KEY || "";
  if (!secret) throw new Error("Missing BRIDGE_ENCRYPTION_KEY");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(obj), "utf8"),
    cipher.final()
  ]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function decrypt(value) {
  const [iv, tag, encrypted] = String(value || "").split(".");
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted payload");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final()
    ]).toString("utf8")
  );
}

export function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function allowedAction(action) {
  return ["me", "flights", "start", "attendance", "end"].includes(action);
}
