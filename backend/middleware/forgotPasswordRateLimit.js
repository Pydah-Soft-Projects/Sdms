const crypto = require('crypto');

const DAILY_LIMIT = 5;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOCKOUT_MS = 60 * 60 * 1000;
const attemptsByContact = new Map();
let requestsSinceCleanup = 0;

const normalizeContact = (body = {}) => {
  const contact = String(body.email || body.mobileNumber || body.phone || '').trim();
  if (!contact) return '';
  return contact.includes('@')
    ? contact.toLowerCase()
    : contact.replace(/\D/g, '');
};

const consumeForgotPasswordAttempt = (contact, now = Date.now()) => {
  const normalizedContact = String(contact || '').trim().toLowerCase();
  if (!normalizedContact) return null;

  const key = crypto.createHash('sha256').update(normalizedContact).digest('hex');
  let entry = attemptsByContact.get(key);

  if (!entry || now - entry.windowStartedAt >= DAILY_WINDOW_MS) {
    entry = { count: 0, windowStartedAt: now, lockedUntil: 0 };
  }

  const attemptsRemaining = Math.max(0, DAILY_LIMIT - entry.count);
  if (entry.lockedUntil > now) {
    attemptsByContact.set(key, entry);
    return {
      allowed: false,
      attemptsRemaining,
      retryAfterMs: entry.lockedUntil - now,
      message: `Too many forgot password requests. You have ${attemptsRemaining} attempts left today. Please try again after one hour.`
    };
  }

  if (entry.count >= DAILY_LIMIT) {
    attemptsByContact.set(key, entry);
    return {
      allowed: false,
      attemptsRemaining: 0,
      retryAfterMs: Math.max(0, entry.windowStartedAt + DAILY_WINDOW_MS - now),
      message: 'You have used all 5 forgot password attempts for today. Please try again when your 24-hour limit resets.'
    };
  }

  entry.count += 1;
  entry.lockedUntil = entry.count % 2 === 0 && entry.count < DAILY_LIMIT
    ? now + LOCKOUT_MS
    : 0;
  attemptsByContact.set(key, entry);

  requestsSinceCleanup += 1;
  if (requestsSinceCleanup >= 256) {
    for (const [contactKey, contactEntry] of attemptsByContact) {
      if (now - contactEntry.windowStartedAt >= DAILY_WINDOW_MS) {
        attemptsByContact.delete(contactKey);
      }
    }
    requestsSinceCleanup = 0;
  }

  return {
    allowed: true,
    attemptsRemaining: DAILY_LIMIT - entry.count,
    retryAfterMs: entry.lockedUntil > now
      ? LOCKOUT_MS
      : entry.count === DAILY_LIMIT
        ? Math.max(0, entry.windowStartedAt + DAILY_WINDOW_MS - now)
        : 0
  };
};

const forgotPasswordRateLimit = (req, res, next) => {
  const contact = normalizeContact(req.body);
  if (!contact) return next();

  const result = consumeForgotPasswordAttempt(contact);
  if (!result) return next();

  req.forgotPasswordLimit = result;
  if (!result.allowed) {
    return res.status(429).json({
      success: false,
      message: result.message,
      attemptsRemaining: result.attemptsRemaining,
      retryAfterMs: result.retryAfterMs
    });
  }

  return next();
};

const includeForgotPasswordLimit = (req, response) => ({
  ...response,
  ...(req.forgotPasswordLimit && {
    attemptsRemaining: req.forgotPasswordLimit.attemptsRemaining,
    retryAfterMs: req.forgotPasswordLimit.retryAfterMs
  })
});

module.exports = {
  consumeForgotPasswordAttempt,
  forgotPasswordRateLimit,
  includeForgotPasswordLimit
};
