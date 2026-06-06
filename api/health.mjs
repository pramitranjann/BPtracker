import { sendNodeJson } from "../lib/http.mjs";
import { ensureDataStore, getStorageMode } from "../lib/store.mjs";

export default async function handler(_req, res) {
  try {
    await ensureDataStore();
    sendNodeJson(res, 200, {
      ok: true,
      storage: getStorageMode()
    });
  } catch (error) {
    sendNodeJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}
