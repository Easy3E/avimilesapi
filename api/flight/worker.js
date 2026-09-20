import { supabase, decrypt, json, workerSecret } from "./_common.js";

function authorised(req) {
  const got = String(req.headers["x-bridge-secret"] || "");
  const expected = workerSecret();
  return Boolean(got && expected && got === expected);
}

export default async function handler(req, res) {
  if (!authorised(req))
    return json(res, 401, { error: "Invalid bridge secret" });

  try {
    if (req.method === "GET") {
      // Remove old jobs whenever the worker polls.
      await supabase("avimiles_jobs?expires_at=lt.now()", { method: "DELETE" });

      const rows = await supabase(
        "avimiles_jobs?status=eq.pending&order=created_at.asc&limit=1&select=id,action,payload"
      );

      if (!rows?.length) return json(res, 200, { job: null });

      const row = rows[0];

      // Claim only if it is still pending.
      const claimed = await supabase(
        `avimiles_jobs?id=eq.${encodeURIComponent(row.id)}&status=eq.pending`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "processing" })
        }
      );

      if (!claimed?.length) return json(res, 200, { job: null });

      const payload = decrypt(row.payload);
      delete payload.result_token;

      return json(res, 200, {
        job: {
          id: row.id,
          ...payload
        }
      });
    }

    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const id = String(b.request_id || "");

      if (!id) return json(res, 400, { error: "Missing request_id" });

      const ok = Boolean(b.ok);

      const updated = await supabase(
        `avimiles_jobs?id=eq.${encodeURIComponent(id)}&status=eq.processing`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: ok ? "completed" : "failed",
            result: ok ? (b.data ?? null) : null,
            error: ok ? null : String(b.error || "Worker request failed")
          })
        }
      );

      if (!updated?.length)
        return json(res, 404, { error: "Request expired, missing, or already finished" });

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: "Worker bridge failed" });
  }
}
