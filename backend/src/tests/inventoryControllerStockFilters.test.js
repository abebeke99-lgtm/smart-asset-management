const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Inventory } = require('../models');
const { getInventory } = require('../controllers/inventoryController');

test('inventory stock filters build valid Sequelize conditions without throwing', async () => {
  const originalFindAndCountAll = Inventory.findAndCountAll;
  const originalFindAll = Inventory.findAll;

  try {
    let whereSeen;

    Inventory.findAndCountAll = async ({ where }) => {
      whereSeen = where;
      return { rows: [], count: 0 };
    };

    Inventory.findAll = async () => [];

    await getInventory(
      { query: { page: '1', limit: '20', stockLevel: 'low' } },
      { json: () => {} },
      (error) => {
        throw error;
      }
    );

    assert.ok(whereSeen && whereSeen[Op.and], 'stock level filter should build a Sequelize AND condition');
    assert.equal(whereSeen[Op.and].length, 2, 'low stock filter should include both minimum and zero-stock checks');
  } finally {
    Inventory.findAndCountAll = originalFindAndCountAll;
    Inventory.findAll = originalFindAll;
  }
});
