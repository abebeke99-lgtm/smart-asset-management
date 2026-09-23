const { Op } = require('sequelize');
const { sequelize, AuditLog, Budget, FiscalYear, FundSource, College, Department, PurchaseOrder, Invoice, Payment } = require('../models');
const { assertBudgetPayload, summarizeBudget, fail } = require('../services/budgetService');

const include = [
  { model: FiscalYear, as: 'FiscalYear', attributes: ['id', 'code', 'name', 'status'] },
  { model: FundSource, as: 'FundSource', attributes: ['id', 'code', 'name'] },
  { model: College, as: 'CollegeRecord', attributes: ['id', 'collegeCode', 'collegeName'], required: false },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'code', 'name'], required: false },
];
const audit = (transaction, req, action, budgetId, details) => AuditLog.create({ userId: req.user.id, action, entity: `budget:${budgetId}`, details: JSON.stringify(details || {}) }, { transaction });
const normalize = async (record, transaction) => {
  const summary = await summarizeBudget(record, transaction);
  const value = record.toJSON ? record.toJSON() : record;
  return { ...summary, fiscalYear: value.FiscalYear || null, fundSource: value.FundSource || null, college: value.CollegeRecord || null, department: value.DepartmentRecord || null };
};

const listBudgets = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || req.query.pageSize, 10) || 20));
    const search = String(req.query.search || '').trim();
    const where = {};
    if (search) where[Op.or] = [{ budgetCode: { [Op.like]: `%${search}%` } }, { budgetName: { [Op.like]: `%${search}%` } }];
    if (req.query.status) where.status = req.query.status;
    if (req.query.fiscalYearId) where.fiscalYearId = Number(req.query.fiscalYearId);
    if (req.query.fundSourceId) where.fundSourceId = Number(req.query.fundSourceId);
    if (req.query.collegeId) where.collegeId = Number(req.query.collegeId);
    if (req.query.departmentId) where.departmentId = Number(req.query.departmentId);
    const result = await Budget.findAndCountAll({ where, include, limit, offset: (page - 1) * limit, distinct: true, order: [['createdAt', 'DESC']] });
    const budgets = await Promise.all(result.rows.map((row) => normalize(row, null)));
    const summary = budgets.reduce((total, row) => ({ totalBudgets: total.totalBudgets + 1, activeBudgets: total.activeBudgets + (row.status === 'ACTIVE' ? 1 : 0), totalAllocated: Number(total.totalAllocated) + Number(row.allocation), totalCommitted: Number(total.totalCommitted) + Number(row.committed), totalSpent: Number(total.totalSpent) + Number(row.spent), totalAvailable: Number(total.totalAvailable) + Number(row.available), overBudget: total.overBudget + (row.overBudget ? 1 : 0) }), { totalBudgets: 0, activeBudgets: 0, totalAllocated: 0, totalCommitted: 0, totalSpent: 0, totalAvailable: 0, overBudget: 0 });
    const [fiscalYears, fundSources, colleges, departments] = await Promise.all([
      FiscalYear.findAll({ order: [['startDate', 'DESC']] }),
      FundSource.findAll({ where: { status: 'active' }, order: [['name', 'ASC']] }),
      College.findAll({ where: { status: 'active' }, attributes: ['id', 'collegeCode', 'collegeName'], order: [['collegeName', 'ASC']] }),
      Department.findAll({ where: { status: 'active' }, attributes: ['id', 'code', 'name'], order: [['name', 'ASC']] }),
    ]);
    return res.json({ success: true, data: budgets, summary, filters: { statuses: ['DRAFT', 'ACTIVE', 'CLOSED', 'SUSPENDED', 'CANCELLED'], fiscalYears, fundSources, colleges, departments }, pagination: { page, limit, total: result.count, totalPages: Math.max(1, Math.ceil(result.count / limit)) } });
  } catch (error) { return next(error); }
};

const getBudget = async (req, res, next) => {
  try {
    const record = await Budget.findByPk(req.params.id, { include });
    if (!record) return res.status(404).json({ success: false, message: 'Budget not found' });
    const data = await normalize(record, null);
    const orders = await PurchaseOrder.findAll({ where: { budgetId: record.id }, attributes: ['id', 'poNumber', 'supplierName', 'orderDate', 'totalAmount', 'status'], order: [['orderDate', 'DESC']] });
    const invoices = await Invoice.findAll({ include: [{ model: PurchaseOrder, as: 'PurchaseOrder', where: { budgetId: record.id }, attributes: [] }], attributes: ['id', 'invoiceNumber', 'supplierName', 'invoiceDate', 'totalAmount', 'status', 'approvalStatus'], order: [['invoiceDate', 'DESC']] });
    const payments = await Payment.findAll({ include: [{ model: Invoice, as: 'InvoiceRecord', include: [{ model: PurchaseOrder, as: 'PurchaseOrder', where: { budgetId: record.id }, attributes: [] }], attributes: [] }], attributes: ['id', 'paymentNumber', 'paymentDate', 'amount', 'status'], order: [['paymentDate', 'DESC']] });
    return res.json({ success: true, data: { ...data, transactions: { purchaseOrders: orders, invoices, payments } } });
  } catch (error) { return next(error); }
};

const createBudget = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const values = await assertBudgetPayload(req.body, transaction);
    const duplicate = await Budget.findOne({ where: { budgetCode: values.budgetCode }, transaction });
    if (duplicate) throw fail('Budget code already exists', 409);
    const record = await Budget.create({ ...values, createdBy: req.user.id }, { transaction });
    await audit(transaction, req, 'CREATE_BUDGET', record.id, values);
    await transaction.commit();
    return getBudget({ ...req, params: { id: record.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

const updateBudget = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const record = await Budget.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!record) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Budget not found' }); }
    if (['CLOSED', 'CANCELLED'].includes(record.status)) throw fail('Closed or cancelled budgets cannot be edited', 409);
    if (Object.keys(req.body || {}).length === 1 && req.body.status) {
      const allowed = { DRAFT: ['ACTIVE', 'CANCELLED'], ACTIVE: ['SUSPENDED', 'CLOSED'], SUSPENDED: ['ACTIVE', 'CLOSED'] };
      const nextStatus = String(req.body.status).toUpperCase();
      if (!allowed[record.status]?.includes(nextStatus)) throw fail(`Cannot transition budget from ${record.status} to ${nextStatus}`, 409);
      await record.update({ status: nextStatus }, { transaction });
      await audit(transaction, req, `BUDGET_${nextStatus}`, record.id, { previousStatus: record.previous('status'), status: nextStatus });
      await transaction.commit();
      return getBudget({ ...req, params: { id: record.id } }, res, next);
    }
    const values = await assertBudgetPayload(req.body, transaction, record);
    const duplicate = await Budget.findOne({ where: { budgetCode: values.budgetCode, id: { [Op.ne]: record.id } }, transaction });
    if (duplicate) throw fail('Budget code already exists', 409);
    const oldValues = record.toJSON();
    await record.update(values, { transaction });
    await audit(transaction, req, 'UPDATE_BUDGET', record.id, { oldValues, newValues: values });
    await transaction.commit();
    return getBudget({ ...req, params: { id: record.id } }, res, next);
  } catch (error) { await transaction.rollback(); return next(error); }
};

const deleteBudget = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const record = await Budget.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!record) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Budget not found' }); }
    if (record.status !== 'DRAFT') throw fail('Only draft budgets can be deleted', 409);
    await audit(transaction, req, 'DELETE_BUDGET', record.id, record.toJSON());
    await record.destroy({ transaction });
    await transaction.commit();
    return res.json({ success: true, message: 'Budget deleted' });
  } catch (error) { await transaction.rollback(); return next(error); }
};

module.exports = { listBudgets, getBudget, createBudget, updateBudget, deleteBudget };
