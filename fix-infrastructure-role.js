const { sequelize } = require('./backend/src/config/database');

(async () => {
  try {
    await sequelize.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','ict_officer','department_head','finance','store_manager','maintenance','infrastructure','staff','student') NOT NULL DEFAULT 'student'");
    await sequelize.query("UPDATE users SET role = 'infrastructure' WHERE username = 'infrastructure' OR role = '' OR role IS NULL");
    const [rows] = await sequelize.query("SELECT id, username, role, department, active FROM users WHERE username = 'infrastructure'");
    console.log(JSON.stringify(rows, null, 2));
    await sequelize.close();
  } catch (error) {
    console.error('DB_FIX_ERROR:', error.message);
    process.exit(1);
  }
})();
