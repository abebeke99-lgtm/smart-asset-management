const express = require("express");
const router = express.Router();

const db = require("../config/db");

// Use your existing authentication middleware.
// If your project uses a different filename, keep your existing middleware.
const { authenticateToken } = require("../middleware/auth");

/*
|--------------------------------------------------------------------------
| Infrastructure Dashboard
|--------------------------------------------------------------------------
| GET /api/infrastructure/dashboard
|
| Returns real database information for the Infrastructure Directorate.
|--------------------------------------------------------------------------
*/

router.get(
  "/dashboard",
  authenticateToken,
  async (req, res) => {
    try {
      /*
       * ---------------------------------------------------------------
       * ROLE AUTHORIZATION
       * ---------------------------------------------------------------
       */

      const role =
        req.user?.role ||
        req.user?.user_role ||
        req.user?.role_name;

      const allowedRoles = [
        "infrastructure",
        "infrastructure_officer",
        "infrastructure_directorate",
        "admin",
        "system_admin",
        "system_administrator",
      ];

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to access Infrastructure Dashboard",
        });
      }

      /*
       * ---------------------------------------------------------------
       * INFRASTRUCTURE ASSET CONDITION
       * ---------------------------------------------------------------
       *
       * We identify infrastructure assets from their category/name.
       *
       * If your database has a dedicated asset_type/module column,
       * use that instead of this condition.
       */

      const infrastructureCondition = `
        (
          LOWER(COALESCE(category, '')) LIKE '%infrastructure%'
          OR LOWER(COALESCE(category, '')) LIKE '%building%'
          OR LOWER(COALESCE(category, '')) LIKE '%facility%'
          OR LOWER(COALESCE(category, '')) LIKE '%electrical%'
          OR LOWER(COALESCE(category, '')) LIKE '%generator%'
          OR LOWER(COALESCE(category, '')) LIKE '%transformer%'
          OR LOWER(COALESCE(category, '')) LIKE '%ups%'
          OR LOWER(COALESCE(category, '')) LIKE '%inverter%'
          OR LOWER(COALESCE(category, '')) LIKE '%solar%'
          OR LOWER(COALESCE(category, '')) LIKE '%water%'
          OR LOWER(COALESCE(category, '')) LIKE '%pump%'
          OR LOWER(COALESCE(category, '')) LIKE '%tank%'
          OR LOWER(COALESCE(category, '')) LIKE '%road%'
          OR LOWER(COALESCE(category, '')) LIKE '%drainage%'
          OR LOWER(COALESCE(name, '')) LIKE '%generator%'
          OR LOWER(COALESCE(name, '')) LIKE '%transformer%'
          OR LOWER(COALESCE(name, '')) LIKE '%building%'
          OR LOWER(COALESCE(name, '')) LIKE '%electrical%'
          OR LOWER(COALESCE(name, '')) LIKE '%solar%'
          OR LOWER(COALESCE(name, '')) LIKE '%water%'
        )
      `;

      /*
       * ---------------------------------------------------------------
       * TOTAL INFRASTRUCTURE ASSETS
       * ---------------------------------------------------------------
       */

      const [totalRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM assets
        WHERE ${infrastructureCondition}
      `);

      const totalInfrastructureAssets =
        Number(totalRows[0]?.total || 0);

      /*
       * ---------------------------------------------------------------
       * BUILDINGS
       * ---------------------------------------------------------------
       */

      const [buildingRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM assets
        WHERE
          (
            LOWER(COALESCE(category, '')) LIKE '%building%'
            OR LOWER(COALESCE(category, '')) LIKE '%facility%'
            OR LOWER(COALESCE(name, '')) LIKE '%building%'
          )
      `);

      const buildings =
        Number(buildingRows[0]?.total || 0);

      /*
       * ---------------------------------------------------------------
       * ELECTRICAL SYSTEMS
       * ---------------------------------------------------------------
       */

      const [electricalRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM assets
        WHERE
          (
            LOWER(COALESCE(category, '')) LIKE '%electrical%'
            OR LOWER(COALESCE(name, '')) LIKE '%electrical%'
            OR LOWER(COALESCE(category, '')) LIKE '%power%'
          )
      `);

      const electricalSystems =
        Number(electricalRows[0]?.total || 0);

      /*
       * ---------------------------------------------------------------
       * UNDER MAINTENANCE
       * ---------------------------------------------------------------
       */

      const [maintenanceRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM assets
        WHERE
          ${infrastructureCondition}
          AND LOWER(COALESCE(status, '')) IN (
            'maintenance',
            'in maintenance',
            'under maintenance',
            'repair',
            'under repair'
          )
      `);

      const underMaintenance =
        Number(maintenanceRows[0]?.total || 0);

      /*
       * ---------------------------------------------------------------
       * WORK ORDERS
       * ---------------------------------------------------------------
       *
       * Use the existing work_orders table if it exists.
       * If your project uses another table, adapt this query.
       */

      let openWorkOrders = 0;

      try {
        const [workOrderRows] = await db.query(`
          SELECT COUNT(*) AS total
          FROM work_orders
          WHERE LOWER(COALESCE(status, '')) IN (
            'open',
            'pending',
            'pending assignment',
            'assigned',
            'in progress',
            'in_progress'
          )
        `);

        openWorkOrders =
          Number(workOrderRows[0]?.total || 0);
      } catch (error) {
        /*
         * Do not break the entire dashboard if the project
         * currently does not contain work_orders.
         */
        console.warn(
          "work_orders table unavailable:",
          error.message
        );

        openWorkOrders = 0;
      }

      /*
       * ---------------------------------------------------------------
       * CRITICAL ALERTS
       * ---------------------------------------------------------------
       */

      const [criticalRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM assets
        WHERE
          ${infrastructureCondition}
          AND (
            LOWER(COALESCE(status, '')) IN (
              'critical',
              'damaged',
              'failed',
              'danger',
              'unsafe',
              'missing'
            )
          )
      `);

      const criticalAlerts =
        Number(criticalRows[0]?.total || 0);

      /*
       * ---------------------------------------------------------------
       * OPERATIONAL ASSETS
       * ---------------------------------------------------------------
       */

      const [operationalRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM assets
        WHERE
          ${infrastructureCondition}
          AND LOWER(COALESCE(status, '')) IN (
            'available',
            'operational',
            'active',
            'working',
            'assigned'
          )
      `);

      const operationalAssets =
        Number(operationalRows[0]?.total || 0);

      /*
       * ---------------------------------------------------------------
       * GENERATORS
       * ---------------------------------------------------------------
       */

      const [generatorRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM assets
        WHERE
          (
            LOWER(COALESCE(category, '')) LIKE '%generator%'
            OR LOWER(COALESCE(name, '')) LIKE '%generator%'
          )
      `);

      const generators =
        Number(generatorRows[0]?.total || 0);

      /*
       * ---------------------------------------------------------------
       * TRANSFORMERS
       * ---------------------------------------------------------------
       */

      const [transformerRows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM assets
        WHERE
          (
            LOWER(COALESCE(category, '')) LIKE '%transformer%'
            OR LOWER(COALESCE(name, '')) LIKE '%transformer%'
          )
      `);

      const transformers =
        Number(transformerRows[0]?.total || 0);

      /*
       * ---------------------------------------------------------------
       * RECENT INFRASTRUCTURE ASSETS
       * ---------------------------------------------------------------
       */

      const [recentAssets] = await db.query(`
        SELECT
          id,
          asset_tag,
          name,
          category,
          serial_number,
          status,
          location,
          created_at
        FROM assets
        WHERE ${infrastructureCondition}
        ORDER BY created_at DESC
        LIMIT 8
      `);

      /*
       * ---------------------------------------------------------------
       * RECENT WORK ORDERS
       * ---------------------------------------------------------------
       */

      let recentWorkOrders = [];

      try {
        const [workRows] = await db.query(`
          SELECT
            id,
            title,
            description,
            priority,
            status,
            created_at
          FROM work_orders
          ORDER BY created_at DESC
          LIMIT 6
        `);

        recentWorkOrders = workRows;
      } catch (error) {
        console.warn(
          "Could not load recent work orders:",
          error.message
        );

        recentWorkOrders = [];
      }

      /*
       * ---------------------------------------------------------------
       * ASSET STATUS BREAKDOWN
       * ---------------------------------------------------------------
       */

      const [statusRows] = await db.query(`
        SELECT
          LOWER(COALESCE(status, 'unknown')) AS status,
          COUNT(*) AS total
        FROM assets
        WHERE ${infrastructureCondition}
        GROUP BY LOWER(COALESCE(status, 'unknown'))
        ORDER BY total DESC
      `);

      /*
       * ---------------------------------------------------------------
       * RESPONSE
       * ---------------------------------------------------------------
       */

      return res.json({
        success: true,

        data: {
          summary: {
            totalInfrastructureAssets,
            buildings,
            electricalSystems,
            underMaintenance,
            openWorkOrders,
            criticalAlerts,
          },

          operational: {
            assets: operationalAssets,
            generators,
            transformers,
          },

          statusBreakdown: statusRows,

          recentAssets,

          recentWorkOrders,
        },
      });
    } catch (error) {
      console.error(
        "Infrastructure dashboard error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load Infrastructure Dashboard",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

module.exports = router;