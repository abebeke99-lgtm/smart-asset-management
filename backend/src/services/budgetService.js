const { Op } = require('sequelize');
const { sequelize, Budget, PurchaseOrder, Invoice, Payment } = require('../models');

const COMMITTED_STATUSES = ['Approved', 'Issued', 'Completed'];
const SPENT_PAYMENT_STATUS = 'COMPLETED';

const cents = (value) => {
  const text = String(value ?? '0');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return 0n;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
};
const money = (value) => {
  const amount = cents(value);
  const sign = amount < 0n ? '-' : '';
  const absolute = amount < 0n ? -amount : amount;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};
const fail = (message, status = 422) => Object.assign(new Error(message), { status });

async function getBudgetAmounts(budgetId, transaction) {
  const [committedRows] = await sequelize.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS amount FROM purchase_orders WHERE budget_id = :budgetId AND status IN (:statuses)`,
    { replacements: { budgetId, statuses: COMMITTED_STATUSES }, transaction }
  );
  const [spentRows] = await sequelize.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS amount
     FROM payments p
     INNER JOIN invoices i ON i.id = p.invoice_id
     INNER JOIN purchase_orders po ON po.id = i.purchase_order_id
     WHERE po.budget_id = :budgetId AND p.status = :spentStatus`,
    { replacements: { budgetId, spentStatus: SPENT_PAYMENT_STATUS }, transaction }
  );
  return { committed: money(committedRows[0]?.amount), spent: money(spentRows[0]?.amount) };
}

async function summarizeBudget(budget, transaction) {
  const value = budget.toJSON ? budget.toJSON() : budget;
  const amounts = await getBudgetAmounts(value.id, transaction);
  const allocation = money(value.allocation);
  const available = money(cents(allocation) - cents(amounts.committed) - cents(amounts.spent));
  const utilization = cents(allocation) > 0n
    ? Number(((Number(cents(amounts.committed) + cents(amounts.spent)) / Number(cents(allocation))) * 100).toFixed(2))
    : null;
  return { ...value, allocation, committed: amounts.committed, spent: amounts.spent, available, utilization, overBudget: cents(available) < 0n };
}

async function assertAllocation(allocation) {
  const text = String(allocation ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text) || cents(text) <= 0n) throw fail('Allocation must be a positive financial amount');
  return money(text);
}

async function assertBudgetPayload(body, transaction, existing = null) {
  const fiscalYearId = Number(body.fiscalYearId);
  const fundSourceId = Number(body.fundSourceId);
  if (!Number.isInteger(fiscalYearId) || fiscalYearId <= 0) throw fail('Fiscal year is required');
  if (!Number.isInteger(fundSourceId) || fundSourceId <= 0) throw fail('Fund source is required');
  if (!String(body.budgetCode || '').trim() || !String(body.budgetName || '').trim()) throw fail('Budget code and budget name are required');
  const allocation = await assertAllocation(body.allocation);
  const departmentId = body.departmentId ? Number(body.departmentId) : null;
  const collegeId = body.collegeId ? Number(body.collegeId) : null;
  if (departmentId !== null && (!Number.isInteger(departmentId) || departmentId <= 0)) throw fail('Department is invalid');
  if (collegeId !== null && (!Number.isInteger(collegeId) || collegeId <= 0)) throw fail('College is invalid');
  if (existing) {
    const current = await getBudgetAmounts(existing.id, transaction);
    if (cents(allocation) < cents(current.committed) + cents(current.spent)) throw fail('Allocation cannot be lower than existing committed and spent amounts', 409);
  }
  return { fiscalYearId, fundSourceId, departmentId, collegeId, allocation, budgetCode: String(body.budgetCode).trim(), budgetName: String(body.budgetName).trim(), status: body.status || existing?.status || 'DRAFT', startDate: body.startDate || null, endDate: body.endDate || null, description: String(body.description || '').trim() };
}

async function assertCommitmentAvailable(budgetId, requestedAmount, transaction) {
  const budget = await Budget.findByPk(budgetId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!budget) throw fail('Budget not found', 404);
  if (budget.status !== 'ACTIVE') throw fail('Only active budgets can receive purchase-order commitments', 409);
  const summary = await summarizeBudget(budget, transaction);
  if (cents(requestedAmount) > cents(summary.available)) throw fail('Purchase order cannot be approved because the selected budget does not have sufficient available allocation.', 409);
  return summary;
}

module.exports = { COMMITTED_STATUSES, SPENT_PAYMENT_STATUS, cents, money, fail, getBudgetAmounts, summarizeBudget, assertBudgetPayload, assertCommitmentAvailable };
