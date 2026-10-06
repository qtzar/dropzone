import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../audio/engine';

export const STORAGE_KEY = 'dropzone.v1';
export const MAX_SCORES = 10;

export interface ScoreEntry {
  initials: string;
  score: number;
  wave: number;
}

export interface SaveData {
  version: 1;
  scores: ScoreEntry[];
  settings: AudioSettings;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEFAULT_NAMES = ['ARC', 'MAC', 'DRZ', 'NEO', 'ION', 'JET', 'ZAP', 'ORB', 'SKY', 'ZED'];

export function defaultSave(): SaveData {
  return {
    version: 1,
    scores: DEFAULT_NAMES.map((initials, i) => ({ initials, score: 20000 - i * 2000, wave: 10 - i })),
    settings: { ...DEFAULT_AUDIO_SETTINGS },
  };
}

function isEntry(v: unknown): v is ScoreEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.initials === 'string' && /^[A-Z ]{1,3}$/.test(o.initials) &&
    typeof o.score === 'number' && Number.isInteger(o.score) && o.score >= 0 &&
    typeof o.wave === 'number' && Number.isInteger(o.wave) && o.wave >= 0
  );
}

function volume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function parseSettings(v: unknown): AudioSettings {
  const d = { ...DEFAULT_AUDIO_SETTINGS };
  if (!v || typeof v !== 'object') return d;
  const o = v as Record<string, unknown>;
  return {
    musicVolume: volume(o.musicVolume, d.musicVolume),
    sfxVolume: volume(o.sfxVolume, d.sfxVolume),
    muted: typeof o.muted === 'boolean' ? o.muted : d.muted,
  };
}

export function sortScores(scores: readonly ScoreEntry[]): ScoreEntry[] {
  return [...scores].sort((a, b) => b.score - a.score);
}

export function parseSave(raw: string | null): SaveData {
  if (!raw) return defaultSave();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultSave();
  }
  if (!data || typeof data !== 'object') return defaultSave();
  const o = data as Record<string, unknown>;
  if (o.version !== 1) return defaultSave();
  const valid = Array.isArray(o.scores) ? o.scores.filter(isEntry) : [];
  return {
    version: 1,
    scores: valid.length > 0 ? sortScores(valid).slice(0, MAX_SCORES) : defaultSave().scores,
    settings: parseSettings(o.settings),
  };
}

export function qualifies(scores: readonly ScoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  if (scores.length < MAX_SCORES) return true;
  return score > scores[scores.length - 1].score;
}

export function insertScore(scores: readonly ScoreEntry[], entry: ScoreEntry): { scores: ScoreEntry[]; rank: number } {
  if (!qualifies(scores, entry.score)) return { scores: [...scores], rank: -1 };
  const next = [...scores];
  let i = next.findIndex((e) => entry.score > e.score);
  if (i === -1) i = next.length;
  next.splice(i, 0, entry);
  return { scores: next.slice(0, MAX_SCORES), rank: i };
}

export function loadSave(store: KeyValueStore | null): SaveData {
  try {
    return parseSave(store ? store.getItem(STORAGE_KEY) : null);
  } catch {
    return defaultSave();
  }
}

export function writeSave(store: KeyValueStore | null, data: SaveData): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
