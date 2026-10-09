const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { Asset, Campus, Category, College, Department } = require('../src/models');
const { importInventory } = require('../src/controllers/ictInventoryController');

const originals = {
  assetFindAll: Asset.findAll,
  campusFindAll: Campus.findAll,
  categoryFindAll: Category.findAll,
  collegeFindAll: College.findAll,
  departmentFindAll: Department.findAll,
};

after(() => {
  Asset.findAll = originals.assetFindAll;
  Campus.findAll = originals.campusFindAll;
  Category.findAll = originals.categoryFindAll;
  College.findAll = originals.collegeFindAll;
  Department.findAll = originals.departmentFindAll;
});

const previewImport = async (buffer) => {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await importInventory({
    user: { id: 1, role: 'admin' },
    body: { preview: true },
    file: { buffer },
  }, response, (error) => {
    throw error;
  });

  return response;
};

test('preserves a leap day from CSV and Excel date cells without database writes', async () => {
  Category.findAll = async () => [{ id: 1, name: 'Computing' }];
  Department.findAll = async () => [{ id: 1, name: 'ICT', collegeId: 1 }];
  College.findAll = async () => [{ id: 1, collegeName: 'Science', campusId: 1 }];
  Campus.findAll = async () => [];
  Asset.findAll = async () => [];

  const csv = Buffer.from(
    'name,category,department,location,purchaseDate\nLaptop,Computing,ICT,Room 1,02/29/2024',
    'utf8',
  );
  const csvResponse = await previewImport(csv);
  assert.equal(csvResponse.statusCode, 200);
  assert.equal(csvResponse.body.results[0].valid, true);
  assert.equal(csvResponse.body.results[0].record.purchaseDate, '2024-02-29');

  const originalTimezone = process.env.TZ;
  process.env.TZ = 'America/Sao_Paulo';
  try {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['name', 'category', 'department', 'location', 'purchaseDate'],
      ['Laptop', 'Computing', 'ICT', 'Room 1', new Date(2024, 1, 29)],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    const excel = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      cellDates: true,
    });
    const excelResponse = await previewImport(excel);
    assert.equal(excelResponse.statusCode, 200);
    assert.equal(excelResponse.body.results[0].valid, true);
    assert.equal(excelResponse.body.results[0].record.purchaseDate, '2024-02-29');
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});
