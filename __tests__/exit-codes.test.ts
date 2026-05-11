import { describe, it, expect } from 'vitest';
import { CODES, CliError } from '../lib/exit-codes.js';

describe('exit-codes', () => {
  it('CODES is a fixed numeric map', () => {
    expect(CODES).toEqual({
      SUCCESS: 0,
      RUNTIME: 1,
      USAGE: 2,
      AUTH: 3,
      NOT_FOUND: 4,
      DIRTY: 5,
    });
  });

  it('CliError carries message, code, and hint', () => {
    const e = new CliError('bad', CODES.AUTH, 'gh auth login');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('bad');
    expect(e.code).toBe(3);
    expect(e.hint).toBe('gh auth login');
    expect(e.name).toBe('CliError');
  });

  it('CliError defaults to RUNTIME with no hint', () => {
    const e = new CliError('bad');
    expect(e.code).toBe(CODES.RUNTIME);
    expect(e.hint).toBeUndefined();
  });
});
