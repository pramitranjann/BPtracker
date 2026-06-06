import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const bundledReadingsFile = join(process.cwd(), "data", "readings.json");
const runtimeDataDir = join(tmpdir(), "bp-tracker");
const runtimeReadingsFile = join(runtimeDataDir, "readings.json");

export async function ensureDataStore() {
  await mkdir(runtimeDataDir, { recursive: true });

  if (existsSync(runtimeReadingsFile)) {
    return;
  }

  const seed = existsSync(bundledReadingsFile) ? readFileSync(bundledReadingsFile, "utf8") : "[]\n";
  await writeFile(runtimeReadingsFile, seed, "utf8");
}

export async function readReadings() {
  await ensureDataStore();
  const content = await readFile(runtimeReadingsFile, "utf8");
  const parsed = JSON.parse(content || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeReadings(readings) {
  await ensureDataStore();
  await writeFile(runtimeReadingsFile, `${JSON.stringify(readings, null, 2)}\n`, "utf8");
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
