'use strict';
function trusted(req) {
  const setting = process.env.TRUST_PROXY || '';
  const remote = req.socket.remoteAddress || '';
  if (setting === 'true' || setting === 'loopback')
    return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
  return setting
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(remote);
}
function secure(req) {
  if (req.socket.encrypted) return true;
  if (process.env.PUBLIC_ORIGIN) return new URL(process.env.PUBLIC_ORIGIN).protocol === 'https:';
  return trusted(req) && req.headers['x-forwarded-proto'] === 'https';
}
function expectedOrigin(req) {
  return process.env.PUBLIC_ORIGIN || (secure(req) ? 'https://' : 'http://') + req.headers.host;
}
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      parsed.origin === origin &&
      origin === expectedOrigin(req)
    );
  } catch {
    return false;
  }
}
module.exports = { secure, expectedOrigin, originAllowed };
