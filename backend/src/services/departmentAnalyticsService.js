const repository = require('../repositories/departmentAnalyticsRepository');

const parseDate = (value, field) => {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${field} must use YYYY-MM-DD format`), { statusCode: 400 });
  }
  const time = field === 'dateTo' ? '23:59:59.999' : '00:00:00.000';
  const date = new Date(`${value}T${time}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error(`${field} must be a valid calendar date`), { statusCode: 400 });
  }
  return date;
};

const parseFilters = (query = {}) => {
  const from = parseDate(query.dateFrom, 'dateFrom');
  const to = parseDate(query.dateTo, 'dateTo');
  if (from && to && from > to) {
    throw Object.assign(new Error('dateFrom must be before or equal to dateTo'), { statusCode: 400 });
  }
  return { from, to };
};

const parsePagination = (query = {}) => {
  const parseValue = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : NaN;
  };
  const page = parseValue(query.page, 1);
  const limit = parseValue(query.limit, 50);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || limit < 1 || limit > 100) {
    throw Object.assign(new Error('page must be positive and limit must be between 1 and 100'), { statusCode: 400 });
  }
  return { page, limit };
};

const getAnalytics = (departmentId, query) => repository.getDepartmentAnalytics(departmentId, parseFilters(query));

const getReport = async (departmentId, type, query) => {
  const filters = {
    ...parseFilters(query),
    ...parsePagination(query),
    search: String(query.search || '').trim(),
    status: String(query.status || '').trim(),
  };
  if (filters.search.length > 100 || filters.status.length > 50) {
    throw Object.assign(new Error('Search and status filters exceed their maximum length'), { statusCode: 400 });
  }
  const result = await repository.getDepartmentReport(departmentId, type, filters);
  if (!result) throw Object.assign(new Error('Unsupported department report type'), { statusCode: 422 });
  return {
    success: true,
    reportType: type,
    data: result.rows,
    total: result.count,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.count,
      pages: Math.ceil(result.count / filters.limit),
    },
  };
};

module.exports = { getAnalytics, getReport, parseFilters, parsePagination };
