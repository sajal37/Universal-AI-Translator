const rateLimit = require('express-rate-limit');

const isTesting = () => process.env.NODE_ENV === 'test' || process.env.IS_TESTING === 'true';

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isTesting
});

const translateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isTesting
});

module.exports = {
    authLimiter,
    translateLimiter
};
