import { describe, it, expect } from 'vitest';
import { PALETTE, explosionColor } from '../../src/render/palette';
import { ENEMY_STATS } from '../../src/game/entities/enemies';
import type { EnemyKind } from '../../src/game/state';

describe('palette', () => {
  it('has a colour for every enemy kind', () => {
    for (const k of Object.keys(ENEMY_STATS) as EnemyKind[]) {
      expect(explosionColor(k)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has landscape colours', () => {
    expect(PALETTE.magma).toMatch(/^#/);
    expect(PALETTE.hotRock).toMatch(/^#/);
    expect(PALETTE.lake).toMatch(/^#/);
  });
});
