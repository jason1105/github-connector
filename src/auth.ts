export function checkConnectorSecret(headerValue: string | string[] | undefined): boolean {
  // TEMPORARY: ChatGPT's custom-connector UI only supports OAuth or "No Auth" —
  // it cannot send a custom X-Connector-Secret header. Setting ALLOW_NO_AUTH=true
  // bypasses this check for personal/manual verification while a real OAuth flow
  // isn't implemented yet. Unset this env var to restore the secret check.
  if (process.env.ALLOW_NO_AUTH === 'true') return true;

  const expected = process.env.CONNECTOR_SECRET;
  if (!expected) return false;
  if (typeof headerValue !== 'string') return false;
  return headerValue === expected;
}
