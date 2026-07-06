import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkConnectorSecret } from '../src/auth.js';

describe('checkConnectorSecret', () => {
  const ORIGINAL_SECRET = process.env.CONNECTOR_SECRET;
  const ORIGINAL_ALLOW_NO_AUTH = process.env.ALLOW_NO_AUTH;

  beforeEach(() => {
    process.env.CONNECTOR_SECRET = 'test-secret-123';
    delete process.env.ALLOW_NO_AUTH;
  });

  afterEach(() => {
    process.env.CONNECTOR_SECRET = ORIGINAL_SECRET;
    process.env.ALLOW_NO_AUTH = ORIGINAL_ALLOW_NO_AUTH;
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

  it('returns true regardless of header when ALLOW_NO_AUTH is "true"', () => {
    process.env.ALLOW_NO_AUTH = 'true';
    expect(checkConnectorSecret(undefined)).toBe(true);
    expect(checkConnectorSecret('anything')).toBe(true);
  });

  it('does not bypass the check when ALLOW_NO_AUTH is any other value', () => {
    process.env.ALLOW_NO_AUTH = 'false';
    expect(checkConnectorSecret('wrong-secret')).toBe(false);
  });
});
