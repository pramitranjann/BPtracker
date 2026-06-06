import { sendJson } from "./_lib/http.mjs";
import { ensureDataStore } from "./_lib/store.mjs";

export default async function handler(_req, res) {
  try {
    await ensureDataStore();
    sendJson(res, 200, {
      ok: true,
      storage: "tmp-file",
      ocrConfigured: Boolean(process.env.OPENAI_API_KEY)
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}
