import crypto from "crypto";
import { supabase, encrypt, json, allowedAction } from "./_common.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const apiKey = String(b.api_key || "").trim();
    const action = String(b.action || "");

    if (!apiKey.startsWith("avi_live_"))
      return json(res, 401, { error: "Invalid AviMiles API key" });

    if (!allowedAction(action))
      return json(res, 400, { error: "Invalid action" });

    const flightId = b.flight_id == null ? null : Number(b.flight_id);
    if (["start", "attendance", "end"].includes(action) &&
        (!Number.isInteger(flightId) || flightId <= 0)) {
      return json(res, 400, { error: "Valid flight_id required" });
    }

    let ids = [];
    if (action === "attendance") {
      if (!Array.isArray(b.roblox_user_ids))
        return json(res, 400, { error: "roblox_user_ids must be an array" });

      ids = [...new Set(
        b.roblox_user_ids.map(x => String(x)).filter(x => /^\d{1,20}$/.test(x))
      )].slice(0, 300);
    }

    const id = crypto.randomUUID();
    const resultToken = crypto.randomBytes(24).toString("base64url");

    const payload = encrypt({
      api_key: apiKey,
      action,
      flight_id: flightId,
      roblox_user_ids: ids,
      result_token: resultToken
    });

    await supabase("avimiles_jobs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id,
        action,
        payload,
        status: "pending"
      })
    });

    return json(res, 202, {
      request_id: id,
      result_token: resultToken,
      status: "queued"
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: "Bridge request failed" });
  }
}
