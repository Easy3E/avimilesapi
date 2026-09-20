import crypto from "crypto";

const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const workerSecret = () => process.env.AVIMILES_FLIGHT_BRIDGE_SECRET || "";

export async function redis(...args) {
  const url = redisUrl(), token = redisToken();
  if (!url || !token) throw new Error("Missing Upstash Redis environment variables");
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error(`Redis error ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function key() {
  const s = workerSecret();
  if (!s) throw new Error("Missing AVIMILES_FLIGHT_BRIDGE_SECRET");
  return crypto.createHash("sha256").update(s).digest();
}
export function encrypt(obj) {
  const iv=crypto.randomBytes(12), c=crypto.createCipheriv("aes-256-gcm",key(),iv);
  const enc=Buffer.concat([c.update(JSON.stringify(obj),"utf8"),c.final()]);
  return [iv.toString("base64url"),c.getAuthTag().toString("base64url"),enc.toString("base64url")].join(".");
}
export function decrypt(v) {
  const [a,b,c]=String(v||"").split(".");
  const d=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(a,"base64url"));
  d.setAuthTag(Buffer.from(b,"base64url"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(c,"base64url")),d.final()]).toString("utf8"));
}
export function json(res, status, body) {
  res.status(status).setHeader("Content-Type","application/json");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}
export function allowedAction(a) {
  return ["me","flights","start","attendance","end"].includes(a);
}
