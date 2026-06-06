import { parseJsonBody, sendJson } from "./_lib/http.mjs";
import { normalizeReading, readReadings, writeReading } from "./_lib/store.mjs";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      sendJson(res, 200, { readings: await readReadings() });
      return;
    }

    if (req.method === "POST") {
      const body = await parseJsonBody(req);
      const reading = await writeReading(normalizeReading(body));
      sendJson(res, 201, { reading });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}
