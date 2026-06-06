import { parseJsonBody, sendJson } from "./_lib/http.mjs";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await parseJsonBody(req);
    if (!body?.imageDataUrl || typeof body.imageDataUrl !== "string") {
      sendJson(res, 400, { error: "imageDataUrl is required." });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      sendJson(res, 501, {
        error: "Server OCR is not configured.",
        code: "OCR_NOT_CONFIGURED"
      });
      return;
    }

    sendJson(res, 501, {
      error: "OCR is not enabled in the serverless deployment path yet.",
      code: "OCR_UNAVAILABLE"
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}
