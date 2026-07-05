export function checkConnectorSecret(headerValue: string | string[] | undefined): boolean {
  const expected = process.env.CONNECTOR_SECRET;
  if (!expected) return false;
  if (typeof headerValue !== 'string') return false;
  return headerValue === expected;
}
