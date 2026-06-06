export async function parseRequestJson(request) {
  const raw = await request.text();
  return raw.trim() ? JSON.parse(raw) : {};
}

export function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(`${JSON.stringify(body)}\n`, {
    ...init,
    headers
  });
}
