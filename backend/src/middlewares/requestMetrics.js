const MAX_SAMPLES = 5000;
const samples = [];

const requestMetricsMiddleware = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.once('finish', () => {
    const duration = Number(process.hrtime.bigint() - started) / 1000000;
    samples.push({ method: req.method, path: req.route?.path || req.path, status: res.statusCode, duration, timestamp: new Date(), userId: req.user?.id || null });
    if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
  });
  next();
};

const getRequestMetrics = ({ from = null, to = null } = {}) => {
  const start = from ? new Date(from).getTime() : 0;
  const end = to ? new Date(to).getTime() : Date.now();
  const filtered = samples.filter((sample) => sample.timestamp.getTime() >= start && sample.timestamp.getTime() <= end);
  const successfulRequests = filtered.filter((sample) => sample.status < 400).length;
  const failedRequests = filtered.filter((sample) => sample.status >= 400).length;
  const totalResponseTime = filtered.reduce((sum, sample) => sum + sample.duration, 0);
  return { requests: filtered, requestsToday: filtered.filter((sample) => sample.timestamp.toDateString() === new Date().toDateString()).length, successfulRequests, failedRequests, averageResponseTime: filtered.length ? Number((totalResponseTime / filtered.length).toFixed(2)) : 0, slowRequests: filtered.filter((sample) => sample.duration > 1000).length, collectedSamples: filtered.length, available: true };
};

module.exports = { requestMetricsMiddleware, getRequestMetrics };
