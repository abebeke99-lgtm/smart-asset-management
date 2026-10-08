const { sequelize, User, FinanceTransaction } = require('../models');

const sampleTransactions = [
  ['debit', 'posted', 12500, 'Office supplies', 'Supplies expense'],
  ['credit', 'posted', 7800, 'Training refund', 'Training recovery'],
  ['debit', 'pending', 22600, 'Network equipment', 'ICT equipment'],
  ['credit', 'pending', 3500, 'Asset sale proceeds', 'Disposal proceeds'],
  ['debit', 'posted', 9400, 'Laboratory materials', 'Laboratory supplies'],
  ['credit', 'posted', 12000, 'Budget adjustment', 'Budget transfer'],
  ['debit', 'pending', 16250, 'Maintenance parts', 'Maintenance expense'],
  ['credit', 'posted', 6700, 'Invoice correction', 'Accounts payable'],
  ['debit', 'voided', 4800, 'Duplicate payment entry', 'Accounts payable'],
  ['credit', 'pending', 2950, 'Supplier rebate', 'Supplier credits'],
];

async function seedFinanceTransactions() {
  const financeUser = await User.findOne({ where: { role: 'finance' }, order: [['id', 'ASC']] });
  if (!financeUser) throw new Error('A finance user is required before seeding sample financial transactions.');
  const year = new Date().getFullYear();
  let created = 0;
  for (const [index, [type, status, amount, description, accountName]] of sampleTransactions.entries()) {
    const transactionNumber = `TXN-DEMO-${year}-${String(index + 1).padStart(6, '0')}`;
    const [record, wasCreated] = await FinanceTransaction.findOrCreate({
      where: { transactionNumber },
      defaults: {
        transactionNumber,
        type,
        status,
        amount,
        currency: 'ETB',
        transactionDate: `${year}-01-${String(index + 1).padStart(2, '0')}`,
        referenceType: 'other',
        referenceNumber: `DEMO-REF-${index + 1}`,
        category: accountName,
        transactionType: 'Adjustment',
        accountName,
        description,
        createdBy: financeUser.id,
        ...(status === 'posted' ? { postedBy: financeUser.id, postedAt: new Date(`${year}-01-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`) } : {}),
        ...(status === 'voided' ? { voidedBy: financeUser.id, voidedAt: new Date(`${year}-01-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`), voidReason: 'Seeded example record for void state.' } : {}),
      },
    });
    if (wasCreated) created += 1;
  }
  console.log(`Financial transaction samples ready (${created} created; ${sampleTransactions.length - created} already existed).`);
}

seedFinanceTransactions()
  .catch((error) => {
    console.error('Could not seed financial transactions:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
