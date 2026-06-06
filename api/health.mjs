import { sendJson } from "./_lib/http.mjs";
import { ensureDataStore, getStorageMode } from "./_lib/store.mjs";

export default async function handler(_req, res) {
  try {
    await ensureDataStore();
    sendJson(res, 200, {
      ok: true,
      storage: getStorageMode()
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}
