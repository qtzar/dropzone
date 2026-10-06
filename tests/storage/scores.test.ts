import { describe, it, expect } from 'vitest';
import {
  STORAGE_KEY, MAX_SCORES, defaultSave, parseSave, sortScores, qualifies, insertScore, loadSave, writeSave,
  type KeyValueStore, type ScoreEntry,
} from '../../src/storage/scores';
import { DEFAULT_AUDIO_SETTINGS } from '../../src/audio/engine';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('defaultSave', () => {
  it('has 10 descending scores and default settings', () => {
    const d = defaultSave();
    expect(d.version).toBe(1);
    expect(d.scores).toHaveLength(MAX_SCORES);
    expect(sortScores(d.scores)).toEqual(d.scores);
    expect(d.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});

describe('parseSave', () => {
  it('falls back to defaults for missing, invalid or wrong-version data', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('not json{')).toEqual(defaultSave());
    expect(parseSave('42')).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: 2, scores: [] }))).toEqual(defaultSave());
  });

  it('drops invalid entries, sorts and truncates', () => {
    const scores = [
      { initials: 'AAA', score: 100, wave: 1 },
      { initials: 'toolong', score: 999, wave: 1 },
      { initials: 'BBB', score: -5, wave: 1 },
      { initials: 'CCC', score: 300, wave: 2 },
      ...Array.from({ length: 12 }, (_, i) => ({ initials: 'ZZZ', score: i, wave: 1 })),
    ];
    const d = parseSave(JSON.stringify({ version: 1, scores, settings: DEFAULT_AUDIO_SETTINGS }));
    expect(d.scores).toHaveLength(MAX_SCORES);
    expect(d.scores[0]).toEqual({ initials: 'CCC', score: 300, wave: 2 });
    expect(d.scores[1].initials).toBe('AAA');
    expect(d.scores.some((e) => e.initials === 'toolong' || e.score < 0)).toBe(false);
  });

  it('uses default scores when none are valid', () => {
    const d = parseSave(JSON.stringify({ version: 1, scores: [{ bad: true }], settings: {} }));
    expect(d.scores).toEqual(defaultSave().scores);
  });

  it('validates and clamps settings', () => {
    const d = parseSave(JSON.stringify({ version: 1, scores: [], settings: { musicVolume: 5, sfxVolume: 'loud', muted: true } }));
    expect(d.settings).toEqual({ musicVolume: 1, sfxVolume: DEFAULT_AUDIO_SETTINGS.sfxVolume, muted: true });
  });
});

describe('qualifies / insertScore', () => {
  const table: ScoreEntry[] = Array.from({ length: 10 }, (_, i) => ({ initials: 'AAA', score: 1000 - i * 100, wave: 1 }));

  it('qualifies only scores that beat the lowest entry of a full table', () => {
    expect(qualifies(table, 150)).toBe(true);
    expect(qualifies(table, 100)).toBe(false);
    expect(qualifies(table.slice(0, 5), 1)).toBe(true);
    expect(qualifies([], 0)).toBe(false);
  });

  it('inserts at the right rank and truncates', () => {
    const r = insertScore(table, { initials: 'NEW', score: 850, wave: 3 });
    expect(r.rank).toBe(2);
    expect(r.scores).toHaveLength(MAX_SCORES);
    expect(r.scores[2].initials).toBe('NEW');
    expect(r.scores[MAX_SCORES - 1].score).toBe(200);
  });

  it('returns rank -1 for non-qualifying scores', () => {
    const r = insertScore(table, { initials: 'NOP', score: 50, wave: 1 });
    expect(r.rank).toBe(-1);
    expect(r.scores).toEqual(table);
  });
});

describe('loadSave / writeSave', () => {
  it('round-trips through a store', () => {
    const store = memoryStore();
    const d = defaultSave();
    d.scores[0] = { initials: 'XYZ', score: 99999, wave: 9 };
    expect(writeSave(store, d)).toBe(true);
    expect(store.data[STORAGE_KEY]).toBeDefined();
    expect(loadSave(store)).toEqual(d);
  });

  it('survives a missing or throwing store', () => {
    expect(loadSave(null)).toEqual(defaultSave());
    expect(loadSave(throwingStore)).toEqual(defaultSave());
    expect(writeSave(null, defaultSave())).toBe(false);
    expect(writeSave(throwingStore, defaultSave())).toBe(false);
  });
});
