const models = require('./src/models');
const controller = require('./src/controllers/collegeController');

const qg = models.sequelize.getQueryInterface().queryGenerator;

const wrap = (model, method) => {
  const original = model[method].bind(model);
  model[method] = async (options = {}) => {
    try {
      const table = model.getTableName();
      const sql = qg.selectQuery(table, options, model);
      console.log(`\n### ${model.name}.${method} ###\n${typeof sql === 'string' ? sql : sql.query}`);
      if (Array.isArray(sql.bind)) console.log('BIND:', JSON.stringify(sql.bind));
    } catch (error) {
      console.log(`\n### ${model.name}.${method} SQL BUILD FAILED: ${error.message}`);
    }
    return method === 'findAndCountAll' ? { count: 0, rows: [] } : [];
  };
};

for (const m of ['Department', 'Category', 'Asset']) wrap(models[m], 'findAll');
for (const m of ['Assignment', 'Maintenance']) wrap(models[m], 'findAll');
wrap(models.Asset, 'findAndCountAll');
for (const m of ['VerificationItem', 'Transfer', 'AssetReturn']) wrap(models[m], 'findAll');
wrap(models.RFIDLog, 'findAll');

models.Asset.count = async () => 0;
models.Asset.sum = async () => 0;
models.Assignment.count = async () => 0;
models.RFIDLog.count = async () => 0;
models.Category.findByPk = async (id) => ({ id, name: 'Equipment' });

const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };

(async () => {
  console.log('======== ANALYTICS ========');
  await controller.getCollegeAssetAnalytics({
    organizationScope: { collegeId: 22, college: { collegeName: 'Science College' } },
    query: { page: '1', limit: '10' },
  }, res, (e) => { console.log('ANALYTICS NEXT ERROR:', e && e.message); });
  console.log('analytics status', res.statusCode);

  console.log('\n======== RFID ========');
  res.statusCode = 200; res.body = null;
  await controller.listCollegeRFIDTracking({
    organizationScope: { collegeId: 22, college: { collegeName: 'Science College' } },
    originalUrl: '/api/college/rfid?page=1&limit=25',
    query: { page: '1', limit: '25' },
  }, res, (e) => { console.log('RFID NEXT ERROR:', e && e.message); });
  console.log('rfid status', res.statusCode);
})();
