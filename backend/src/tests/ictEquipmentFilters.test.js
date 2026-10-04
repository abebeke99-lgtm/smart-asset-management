const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { equipmentCategoryTermsByName, equipmentPredicate } = require('../utils/ictAssetFilters');

test('IT equipment filter recognizes all supported central asset categories', () => {
  const categoryOrName = equipmentPredicate()[Op.or];
  const matchingValues = categoryOrName.map((filter) => Object.values(filter)[0][Op.like]);

  const supportedCategories = ['computing', 'networking', 'printing', 'display', 'power', 'storage', 'communication'];
  assert.deepEqual(Object.keys(equipmentCategoryTermsByName), supportedCategories);

  for (const category of supportedCategories) {
    for (const term of equipmentCategoryTermsByName[category]) {
    assert.ok(
        matchingValues.includes(`%${term}%`),
        `Expected the equipment asset filter to include "${term}" for ${category}`,
    );
    }
  }
});
