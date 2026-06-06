import { parseNodeRequestJson, sendNodeJson } from "../lib/http.mjs";
import { normalizeReading, readReadings, writeReading } from "../lib/store.mjs";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      sendNodeJson(res, 200, { readings: await readReadings() });
      return;
    }

    if (req.method === "POST") {
      const body = await parseNodeRequestJson(req);
      const reading = await writeReading(normalizeReading(body));
      sendNodeJson(res, 201, { reading });
      return;
    }

    sendNodeJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendNodeJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}
