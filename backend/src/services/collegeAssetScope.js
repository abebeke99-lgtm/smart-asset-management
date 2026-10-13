const { Op } = require('sequelize');
const { Department } = require('../models');

const buildCollegeAssetScope = (collegeId, departmentIds = []) => {
  const scopedDepartmentIds = [...new Set(departmentIds
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0))];
  const scope = [{ collegeId: Number(collegeId) }];

  if (scopedDepartmentIds.length) {
    scope.push({
      collegeId: null,
      departmentId: { [Op.in]: scopedDepartmentIds },
    });
  }

  return { [Op.or]: scope };
};

const getCollegeAssetScope = async (collegeId) => {
  const departments = await Department.findAll({
    where: { collegeId },
    attributes: ['id'],
  });
  return buildCollegeAssetScope(collegeId, departments.map((department) => department.id));
};

module.exports = { buildCollegeAssetScope, getCollegeAssetScope };
