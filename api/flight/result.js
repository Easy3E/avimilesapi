import { supabase, decrypt, json } from "./_common.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const id = String(req.query.id || "");
    const token = String(req.headers["x-result-token"] || "");

    if (!id || !token)
      return json(res, 400, { error: "Missing request credentials" });

    const rows = await supabase(
      `avimiles_jobs?id=eq.${encodeURIComponent(id)}&select=id,status,payload,result,error,expires_at&limit=1`
    );

    if (!rows?.length)
      return json(res, 404, { error: "Request expired or not found" });

    const job = rows[0];
    if (new Date(job.expires_at).getTime() < Date.now())
      return json(res, 404, { error: "Request expired or not found" });

    const payload = decrypt(job.payload);
    if (payload.result_token !== token)
      return json(res, 403, { error: "Invalid result token" });

    if (job.status === "failed")
      return json(res, 200, { status: "done", ok: false, error: job.error || "Job failed" });

    if (job.status !== "completed")
      return json(res, 200, { status: job.status });

    return json(res, 200, {
      status: "done",
      ok: true,
      data: job.result
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: "Bridge result failed" });
  }
}
