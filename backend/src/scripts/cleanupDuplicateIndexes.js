/*
 * One-time + idempotent repair: drops duplicate `_N`-suffixed indexes that
 * accumulated because Sequelize's cyclic-reference sync pass re-ran
 * ALTER TABLE ... CHANGE ... UNIQUE on every boot.
 *
 * Rules:
 *  - Group each table's indexes by fingerprint (non_unique + ordered columns).
 *  - Inside a group, prefer the canonical (non-suffixed) name; otherwise the
 *    smallest numeric suffix.
 *  - Drop every other index in the group.
 *  - Never touch PRIMARY. Foreign-key-owned indexes have no suffixed twins and
 *    are therefore preserved.
 */
const { sequelize } = require('../config/database');

(async () => {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();

  const [rows] = await sequelize.query(`
    SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR '|') AS cols
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    GROUP BY TABLE_NAME, INDEX_NAME
    ORDER BY TABLE_NAME, INDEX_NAME
  `);

  const byTable = {};
  for (const row of rows) {
    const table = row.TABLE_NAME;
    if (!byTable[table]) byTable[table] = [];
    byTable[table].push({
      name: row.INDEX_NAME,
      unique: String(row.NON_UNIQUE) === '0',
      cols: String(row.cols),
    });
  }

  let dropped = 0;
  let kept = 0;
  const dropPlan = [];

  for (const [table, indexes] of Object.entries(byTable)) {
    const groups = {};
    for (const ix of indexes) {
      if (ix.name === 'PRIMARY') continue;
      const fingerprint = `${ix.unique ? 'U' : 'N'}:${ix.cols}`;
      if (!groups[fingerprint]) groups[fingerprint] = [];
      groups[fingerprint].push(ix.name);
    }
    for (const [fingerprint, names] of Object.entries(groups)) {
      if (names.length < 2) {
        kept += names.length;
        continue;
      }
      const sorted = [...names].sort((a, b) => {
        const aSuffix = a.match(/^(.+)_(\d+)$/);
        const bSuffix = b.match(/^(.+)_(\d+)$/);
        const aNum = aSuffix ? Number(aSuffix[2]) : -1;
        const bNum = bSuffix ? Number(bSuffix[2]) : -1;
        return aNum - bNum;
      });
      const keep = sorted[0];
      const drop = sorted.slice(1);
      kept += 1;
      for (const name of drop) {
        dropPlan.push({ table, name });
      }
    }
  }

  console.log(`Tables analyzed: ${Object.keys(byTable).length}`);
  console.log(`Indexes to keep: ${kept}, indexes to drop: ${dropPlan.length}`);

  const dryRun = process.argv.includes('--dry-run');
  for (const plan of dropPlan) {
    if (dryRun) {
      console.log(`DRYRUN DROP INDEX ${plan.table}.${plan.name}`);
      continue;
    }
    try {
      await qi.removeIndex(plan.table, plan.name);
      dropped += 1;
      console.log(`DROPPED ${plan.table}.${plan.name}`);
    } catch (error) {
      console.log(`SKIP ${plan.table}.${plan.name}: ${error.message}`);
    }
  }

  console.log(`Dropped ${dropped} duplicate indexes.`);
  process.exit(0);
})().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});