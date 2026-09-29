const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize } = require('../models');
const { dashboard, getMaintenanceReportsCosts } = require('../controllers/maintenanceController');

const enabled = process.env.MAINTENANCE_READONLY_INTEGRATION === '1';

test('SQL SUM matches dashboard and reports cost totals for the same all-time range', { skip: !enabled }, async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'read-only integration test is disabled in production');
  await sequelize.authenticate();

  const [rows] = await sequelize.query(`
    SELECT
      COALESCE(SUM(labor_amount), 0) AS laborCost,
      COALESCE(SUM(parts_amount), 0) AS partsCost,
      COALESCE(SUM(materials_amount), 0) AS materialsCost,
      COALESCE(SUM(other_amount), 0) AS otherCost
    FROM (
      SELECT
        SUM(CASE WHEN LOWER(cost_category) REGEXP 'labor|technician' THEN amount ELSE 0 END) AS labor_amount,
        SUM(CASE WHEN LOWER(cost_category) REGEXP 'material' THEN amount ELSE 0 END) AS materials_amount,
        SUM(CASE WHEN LOWER(cost_category) REGEXP 'part|spare' THEN amount ELSE 0 END) AS parts_amount,
        SUM(CASE WHEN LOWER(cost_category) REGEXP 'labor|technician|material|part|spare' THEN 0 ELSE amount END) AS other_amount
      FROM maintenance_costs
      UNION ALL
      SELECT
        SUM(COALESCE(r.labor_cost, 0)),
        SUM(COALESCE(r.parts_cost, 0)),
        0,
        SUM(CASE WHEN COALESCE(r.total_cost, 0) > 0
          THEN GREATEST(r.total_cost - COALESCE(r.labor_cost, 0) - COALESCE(r.parts_cost, 0), 0)
          ELSE COALESCE(r.service_cost, 0) END)
      FROM maintenance_repairs r
      WHERE NOT EXISTS (
        SELECT 1 FROM maintenance_costs c
        WHERE c.repair_id = r.id OR c.work_order_id = r.work_order_id OR c.maintenance_id = r.maintenance_id
      )
      UNION ALL
      SELECT 0, 0, 0, SUM(COALESCE(NULLIF(w.actual_cost, 0), w.estimated_cost, 0))
      FROM maintenance_work_orders w
      WHERE NOT EXISTS (SELECT 1 FROM maintenance_repairs r WHERE r.work_order_id = w.id)
        AND NOT EXISTS (
          SELECT 1 FROM maintenance_costs c
          WHERE c.work_order_id = w.id OR c.maintenance_id = w.maintenance_id
        )
    ) AS cost_sources
  `);
  const sqlTotal = ['laborCost', 'partsCost', 'materialsCost', 'otherCost']
    .reduce((total, key) => total + Math.round(Number(rows[0][key] || 0) * 100), 0) / 100;
  const request = { query: { period: 'all' }, user: { id: 1, role: 'maintenance', collegeId: null } };
  const invoke = (handler) => new Promise((resolve, reject) => handler(request, {
    json(payload) { resolve(payload); return this; },
    status() { return this; },
  }, reject));
  const [dashboardResponse, reportResponse] = await Promise.all([
    invoke(dashboard),
    invoke(getMaintenanceReportsCosts),
  ]);

  assert.equal(dashboardResponse.data.summary.totalMaintenanceCost, sqlTotal);
  assert.equal(reportResponse.data.summary.totalCost, sqlTotal);
});
