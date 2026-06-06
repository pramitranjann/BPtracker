import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const bundledReadingsFile = join(process.cwd(), "data", "readings.json");
const runtimeDataDir = join(tmpdir(), "bp-tracker");
const runtimeReadingsFile = join(runtimeDataDir, "readings.json");
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function ensureDataStore() {
  if (isSupabaseConfigured()) {
    return;
  }

  await mkdir(runtimeDataDir, { recursive: true });

  if (existsSync(runtimeReadingsFile)) {
    return;
  }

  const seed = existsSync(bundledReadingsFile) ? readFileSync(bundledReadingsFile, "utf8") : "[]\n";
  await writeFile(runtimeReadingsFile, seed, "utf8");
}

export async function readReadings() {
  if (isSupabaseConfigured()) {
    const response = await fetch(`${supabaseUrl}/rest/v1/readings?select=*&order=capturedAt.desc`, {
      headers: supabaseHeaders()
    });

    if (!response.ok) {
      throw new Error(`Supabase read failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload.map(normalizeReading) : [];
  }

  await ensureDataStore();
  const content = await readFile(runtimeReadingsFile, "utf8");
  const parsed = JSON.parse(content || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeReadings(readings) {
  if (isSupabaseConfigured()) {
    const response = await fetch(`${supabaseUrl}/rest/v1/readings`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify(readings.map(normalizeReading))
    });

    if (!response.ok) {
      throw new Error(`Supabase write failed: ${response.status} ${await response.text()}`);
    }

    return;
  }

  await ensureDataStore();
  await writeFile(runtimeReadingsFile, `${JSON.stringify(readings, null, 2)}\n`, "utf8");
}

export async function writeReading(reading) {
  if (isSupabaseConfigured()) {
    const normalized = normalizeReading(reading);
    const response = await fetch(`${supabaseUrl}/rest/v1/readings`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify([normalized])
    });

    if (!response.ok) {
      throw new Error(`Supabase write failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) && payload[0] ? normalizeReading(payload[0]) : normalized;
  }

  const normalized = normalizeReading(reading);
  const readings = await readReadings();
  const nextReadings = [normalized, ...readings.filter((item) => item.id !== normalized.id)].sort(
    (a, b) => new Date(b.capturedAt) - new Date(a.capturedAt)
  );
  await writeReadings(nextReadings);
  return normalized;
}

export function normalizeReading(reading) {
  const contextFlags = {
    ateRecently: Boolean(reading?.contextFlags?.ateRecently),
    hadCaffeine: Boolean(reading?.contextFlags?.hadCaffeine),
    afterWaking: Boolean(reading?.contextFlags?.afterWaking),
    afterNap: Boolean(reading?.contextFlags?.afterNap),
    afterMedication: Boolean(reading?.contextFlags?.afterMedication)
  };

  return {
    id: String(reading?.id || crypto.randomUUID()),
    systolic: Number(reading?.systolic) || 0,
    diastolic: Number(reading?.diastolic) || 0,
    pulse: Number(reading?.pulse) || 0,
    capturedAt: String(reading?.capturedAt || new Date().toISOString()),
    context: String(reading?.context || ""),
    contextFlags,
    position: String(reading?.position || "Sitting"),
    notes: String(reading?.notes || ""),
    medicationTaken: Boolean(reading?.medicationTaken || contextFlags.afterMedication),
    fasting: Boolean(reading?.fasting),
    entryMethod: String(reading?.entryMethod || "manual")
  };
}

export function getStorageMode() {
  return isSupabaseConfigured() ? "supabase" : "tmp-file";
}

function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

function supabaseHeaders() {
  return {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`
  };
}
