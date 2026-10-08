const rateLimit = require('express-rate-limit');

const rateLimitKeyGenerator = (req) => rateLimit.ipKeyGenerator(req.ip);

module.exports = rateLimitKeyGenerator;
