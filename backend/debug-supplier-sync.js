const { sequelize } = require('./src/config/database');
const { Supplier, Asset, PurchaseOrder, Location } = require('./src/models');
const { Op } = require('sequelize');

(async () => {
  try {
    const legacyRows = await Promise.all([
      Asset.findAll({ attributes: ['supplier'], where: { supplier: { [Op.ne]: '' } }, group: ['supplier'], raw: true }),
      PurchaseOrder.findAll({ attributes: ['supplierName'], where: { supplierName: { [Op.ne]: '' } }, group: ['supplierName'], raw: true }),
    ]);

    console.log('legacyRows', legacyRows.length, legacyRows[0].length, legacyRows[1].length);
    const legacyNames = [...new Set([
      ...legacyRows[0].map((row) => row.supplier),
      ...legacyRows[1].map((row) => row.supplierName),
    ].map((name) => String(name || '').trim()).filter(Boolean))];
    console.log('legacyNames', legacyNames.length, legacyNames.slice(0, 10));

    for (const [index, supplierName] of legacyNames.entries()) {
      const result = await Supplier.findOrCreate({
        where: { supplierName },
        defaults: {
          supplierCode: `LEGACY-${String(index + 1).padStart(4, '0')}`,
          supplierName,
          status: 'active',
        },
      });
      console.log('supplier upsert', supplierName, result[1]);
    }

    const distinctLocations = await Asset.findAll({
      attributes: ['location'],
      where: { location: { [Op.ne]: '' } },
      group: ['location'],
      raw: true,
    });
    console.log('distinctLocations', distinctLocations.length, distinctLocations.slice(0, 10));

    for (const row of distinctLocations) {
      const name = String(row.location || '').trim();
      if (name) {
        const result = await Location.findOrCreate({
          where: { name },
          defaults: { name, code: '', description: `${name} asset location` },
        });
        console.log('location upsert', name, result[1]);
      }
    }

    console.log('legacy sync block complete');
  } catch (error) {
    console.error('FAIL', error.message);
    console.error(error.name);
    console.error(error.stack);
    process.exit(1);
  }
})();
