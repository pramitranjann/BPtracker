import { jsonResponse, parseRequestJson } from "../lib/http.mjs";
import { normalizeReading, readReadings, writeReading } from "../lib/store.mjs";

export async function GET() {
  try {
    return jsonResponse({ readings: await readReadings() });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected server error."
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await parseRequestJson(request);
    const reading = await writeReading(normalizeReading(body));
    return jsonResponse({ reading }, { status: 201 });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected server error."
      },
      { status: 500 }
    );
  }
}
