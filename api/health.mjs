import { jsonResponse } from "../lib/http.mjs";
import { ensureDataStore, getStorageMode } from "../lib/store.mjs";

export async function GET() {
  try {
    await ensureDataStore();
    return jsonResponse({
      ok: true,
      storage: getStorageMode()
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected server error."
      },
      { status: 500 }
    );
  }
}
