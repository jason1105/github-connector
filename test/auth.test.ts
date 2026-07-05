import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkConnectorSecret } from '../src/auth.js';

describe('checkConnectorSecret', () => {
  const ORIGINAL_ENV = process.env.CONNECTOR_SECRET;

  beforeEach(() => {
    process.env.CONNECTOR_SECRET = 'test-secret-123';
  });

  afterEach(() => {
    process.env.CONNECTOR_SECRET = ORIGINAL_ENV;
  });

  it('returns true when header matches CONNECTOR_SECRET', () => {
    expect(checkConnectorSecret('test-secret-123')).toBe(true);
  });

  it('returns false when header does not match', () => {
    expect(checkConnectorSecret('wrong-secret')).toBe(false);
  });

  it('returns false when header is undefined', () => {
    expect(checkConnectorSecret(undefined)).toBe(false);
  });

  it('returns false when header is an array', () => {
    expect(checkConnectorSecret(['test-secret-123'])).toBe(false);
  });

  it('returns false when CONNECTOR_SECRET env var is unset', () => {
    delete process.env.CONNECTOR_SECRET;
    expect(checkConnectorSecret('test-secret-123')).toBe(false);
  });
});
