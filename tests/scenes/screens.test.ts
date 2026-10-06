import { describe, it, expect } from 'vitest';
import { ORIGINAL_CREDIT, TRIBUTE_NOTE } from '../../src/scenes/screens';

describe('title credit', () => {
  it('credits the original game, verbatim', () => {
    expect(ORIGINAL_CREDIT).toBe('BASED ON DROPZONE (1984) BY ARCHER MACLEAN - ARENA GRAPHICS / U.S. GOLD');
    expect(TRIBUTE_NOTE).toBe('AN UNOFFICIAL FAN TRIBUTE');
  });
});
