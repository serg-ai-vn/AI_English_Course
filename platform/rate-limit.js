'use strict';
const crypto = require('crypto');
function createLimiter() {
  const rates = new Map();
  function take(key, max) {
    const now = Date.now(),
      e = rates.get(key);
    if (!e || now - e.start >= 60000) {
      rates.set(key, { start: now, n: 1 });
      return true;
    }
    return ++e.n <= max;
  }
  const account = (req, b) =>
    'failure:' +
    crypto
      .createHash('sha256')
      .update(
        [
          req.socket.remoteAddress,
          b.classCode,
          b.role === 'teacher' ? 'teacher' : 'student',
          b.role === 'teacher' ? 'teacher' : b.name,
        ]
          .map((x) =>
            String(x || '')
              .trim()
              .toLowerCase(),
          )
          .join(':'),
      )
      .digest('hex');
  const timer = setInterval(() => {
    for (const [k, v] of rates) if (Date.now() - v.start >= 60000) rates.delete(k);
  }, 60000);
  timer.unref();
  return {
    allow(req, route, a) {
      const ip = req.socket.remoteAddress || '';
      if (!take('global:' + ip, 600)) return false;
      if (route === '/api/login') return take('login:' + ip, 60);
      if (a)
        return take(
          'session:' +
            a.session.classCode +
            ':' +
            a.session.role +
            ':' +
            (a.session.studentId || 'teacher') +
            ':' +
            route,
          120,
        );
      return true;
    },
    loginAllowed(req, b) {
      const e = rates.get(account(req, b));
      return !e || Date.now() - e.start >= 60000 || e.n < 10;
    },
    failure(req, b) {
      take(account(req, b), 10);
    },
    success(req, b) {
      rates.delete(account(req, b));
    },
  };
}
module.exports = { createLimiter };
