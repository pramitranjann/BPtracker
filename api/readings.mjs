import { parseJsonBody, sendJson } from "./_lib/http.mjs";
import { normalizeReading, readReadings, writeReadings } from "./_lib/store.mjs";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      sendJson(res, 200, { readings: await readReadings() });
      return;
    }

    if (req.method === "POST") {
      const body = await parseJsonBody(req);
      const reading = normalizeReading(body);
      const readings = await readReadings();
      const nextReadings = [reading, ...readings.filter((item) => item.id !== reading.id)].sort(
        (a, b) => new Date(b.capturedAt) - new Date(a.capturedAt)
      );
      await writeReadings(nextReadings);
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
