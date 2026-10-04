const { Op, fn, col } = require('sequelize');
const XLSX = require('xlsx');
const {
  sequelize,
  Asset,
  AuditLog,
  Campus,
  Category,
  College,
  Department,
} = require('../models');
const { equipmentTerms, networkTerms } = require('../utils/ictAssetFilters');
const { ASSET_STATUSES } = require('../constants/statuses');

const ICT_TERMS = [...new Set([...equipmentTerms, ...networkTerms, 'ict'])];
const ICT_ASSET_WHERE = {
  [Op.or]: ICT_TERMS.flatMap((term) => [
    { category: { [Op.like]: `%${term}%` } },
    { name: { [Op.like]: `%${term}%` } },
  ]),
};
const STATUS_GROUPS = {
  available: ['available', 'ready', 'idle', 'new'],
  assigned: ['assigned', 'in-use', 'issued', 'allocated'],
  maintenance: [
    'maintenance',
    'under-maintenance',
    'in-maintenance',
    'in-repair',
    'repair',
  ],
  damaged: ['damaged', 'broken', 'faulty'],
  missing: ['missing', 'lost', 'stolen'],
  replaced: ['replaced', 'replacement'],
};
const ASSET_STATUS_VALUES = new Set([
  ...Object.values(ASSET_STATUSES),
  ...Object.values(STATUS_GROUPS).flat(),
  'expired',
]);
const SORT_FIELDS = new Set([
  'name',
  'assetCode',
  'category',
  'serialNumber',
  'status',
  'condition',
  'department',
  'location',
  'campusId',
  'collegeId',
  'departmentId',
  'purchaseDate',
  'expiryDate',
  'createdAt',
  'updatedAt',
]);
const ASSET_INCLUDES = [
  { model: College, attributes: ['id', 'collegeName', 'campusId'] },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'] },
  { model: Campus, as: 'CampusRecord', attributes: ['id', 'campusName'] },
  {
    model: require('../models/Building'),
    as: 'BuildingRecord',
    attributes: ['id', 'buildingName'],
  },
  {
    model: require('../models/Room'),
    as: 'RoomRecord',
    attributes: ['id', 'roomName'],
  },
];

const normalizedValue = (value) =>
  String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');

const getScope = (req) => {
  if (req.user?.role === 'admin') return {};
  const collegeId = Number(req.organizationScope?.collegeId);
  if (!Number.isSafeInteger(collegeId) || collegeId <= 0) {
    const error = new Error('College scope is not configured for this account');
    error.statusCode = 403;
    throw error;
  }
  return { collegeId };
};

const makeAssetWhere = (scope) => ({
  [Op.and]: [scope, ICT_ASSET_WHERE],
});

const serializeAsset = (asset) => {
  const record = asset.toJSON();
  return {
    ...record,
    assetTag: record.assetCode,
    campus: record.CampusRecord?.campusName || '',
    college: record.College?.collegeName || '',
    departmentName: record.DepartmentRecord?.name || record.department || '',
    building: record.BuildingRecord?.buildingName || '',
    room: record.RoomRecord?.roomName || '',
  };
};

const getInventory = async (req, res, next) => {
  try {
    const scope = getScope(req);
    const where = makeAssetWhere(scope);
    const filters = [];
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = String(req.query.search || '').trim().slice(0, 200);

    for (const key of ['category', 'status', 'condition']) {
      if (req.query[key]) filters.push({ [key]: String(req.query[key]).trim() });
    }
    for (const key of ['campusId', 'collegeId', 'departmentId']) {
      if (!req.query[key]) continue;
      const value = Number(req.query[key]);
      if (!Number.isSafeInteger(value) || value <= 0) {
        return res.status(400).json({ success: false, message: `${key} must be a positive integer` });
      }
      filters.push({ [key]: value });
    }
    if (req.query.location) {
      filters.push({ location: { [Op.like]: `%${String(req.query.location).trim().slice(0, 200)}%` } });
    }
    if (search) {
      filters.push({
        [Op.or]: [
          'name',
          'assetCode',
          'serialNumber',
          'category',
          'department',
          'location',
          'manufacturer',
          'model',
        ].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })),
      });
    }
    if (filters.length) where[Op.and].push(...filters);

    const sortBy = SORT_FIELDS.has(String(req.query.sortBy)) ? String(req.query.sortBy) : 'updatedAt';
    const sortOrder = String(req.query.sortOrder || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const [result, total, groupedStatuses, damaged] = await Promise.all([
      Asset.findAndCountAll({
        where,
        include: ASSET_INCLUDES,
        order: [[sortBy, sortOrder]],
        limit,
        offset: (page - 1) * limit,
        distinct: true,
      }),
      Asset.count({ where: makeAssetWhere(scope) }),
      Asset.findAll({
        where: makeAssetWhere(scope),
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      Asset.count({
        where: {
          [Op.and]: [
            makeAssetWhere(scope),
            {
              [Op.or]: [
                { status: { [Op.in]: STATUS_GROUPS.damaged } },
                { condition: { [Op.in]: ['damaged', 'broken', 'faulty'] } },
              ],
            },
          ],
        },
      }),
    ]);

    const statusCounts = groupedStatuses.reduce((counts, row) => {
      const status = normalizedValue(row.status);
      counts[status] = Number(row.count) || 0;
      return counts;
    }, {});
    const sumStatuses = (statuses) =>
      statuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);
    const expired = await Asset.count({
      where: {
        [Op.and]: [
          makeAssetWhere(scope),
          {
            [Op.or]: [
              { status: 'expired' },
              { expiryDate: { [Op.lt]: new Date().toISOString().slice(0, 10) } },
            ],
          },
        ],
      },
    });

    const colleges = await College.findAll({
      where: req.user.role === 'admin' ? {} : { id: scope.collegeId },
      attributes: ['id', 'collegeName', 'campusId'],
      order: [['collegeName', 'ASC']],
    });
    const campusIds = [...new Set(colleges.map((college) => college.campusId).filter(Boolean))];
    const [categories, departments, campuses, statuses, conditions, locations] = await Promise.all([
      Asset.findAll({
        where: makeAssetWhere(scope),
        attributes: [[fn('DISTINCT', col('category')), 'value']],
        raw: true,
      }),
      Department.findAll({
        where: req.user.role === 'admin' ? {} : { ...scope, status: 'active' },
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
      }),
      Campus.findAll({
        where: req.user.role === 'admin'
          ? { status: 'active' }
          : { id: { [Op.in]: campusIds.length ? campusIds : [-1] }, status: 'active' },
        attributes: ['id', 'campusName'],
        order: [['campusName', 'ASC']],
      }),
      Asset.findAll({
        where: makeAssetWhere(scope),
        attributes: [[fn('DISTINCT', col('status')), 'value']],
        raw: true,
      }),
      Asset.findAll({
        where: makeAssetWhere(scope),
        attributes: [[fn('DISTINCT', col('condition')), 'value']],
        raw: true,
      }),
      Asset.findAll({
        where: makeAssetWhere(scope),
        attributes: [[fn('DISTINCT', col('location')), 'value']],
        raw: true,
      }),
    ]);

    return res.json({
      success: true,
      data: result.rows.map(serializeAsset),
      summary: {
        totalItems: total,
        available: sumStatuses(STATUS_GROUPS.available),
        assigned: sumStatuses(STATUS_GROUPS.assigned),
        damaged,
        missing: sumStatuses(STATUS_GROUPS.missing),
        underMaintenance: sumStatuses(STATUS_GROUPS.maintenance),
        replaced: sumStatuses(STATUS_GROUPS.replaced),
        expired,
      },
      pagination: {
        page,
        limit,
        total: result.count,
        totalPages: Math.ceil(result.count / limit),
      },
      options: {
        categories: categories.map((item) => item.value).filter(Boolean).sort().map((name) => ({ name })),
        statuses: statuses.map((item) => item.value).filter(Boolean).sort(),
        conditions: conditions.map((item) => item.value).filter(Boolean).sort(),
        campuses,
        colleges,
        departments,
        locations: locations.map((item) => item.value).filter(Boolean).sort(),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const normalizeHeader = (header) =>
  String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const FIELD_ALIASES = {
  name: ['name', 'itemname', 'assetname'],
  assetCode: ['assetcode', 'assettag', 'assetid', 'assetnumber'],
  serialNumber: ['serialnumber', 'serial', 'sn'],
  category: ['category'],
  department: ['department', 'departmentname', 'departmentid'],
  departmentId: ['departmentid'],
  status: ['status'],
  condition: ['condition'],
  campus: ['campus', 'campusname', 'campusid'],
  college: ['college', 'collegename', 'collegeid'],
  location: ['location'],
  description: ['description', 'notes'],
  manufacturer: ['manufacturer'],
  model: ['model'],
  supplier: ['supplier'],
  purchaseDate: ['purchasedate'],
  expiryDate: ['expirydate'],
  warrantyExpiry: ['warrantyexpiry'],
  purchasePrice: ['purchaseprice', 'purchasecost', 'unitcost'],
  quantity: ['quantity'],
};

const readField = (row, field) => {
  const aliases = FIELD_ALIASES[field] || [normalizeHeader(field)];
  const key = Object.keys(row).find((candidate) => aliases.includes(normalizeHeader(candidate)));
  return key === undefined ? '' : row[key];
};

const cleanString = (value) => String(value ?? '').trim();

const parseDate = (value) => {
  if (value === null || value === undefined || value === '') return { value: null };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { value: value.toISOString().slice(0, 10) };
  }
  const input = cleanString(value);
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [year, month, day] = iso.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return { value: input };
    }
    return { error: 'must be a valid date' };
  }
  const usDate = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (usDate) {
    const [, monthValue, dayValue, yearValue] = usDate;
    const month = Number(monthValue);
    const day = Number(dayValue);
    const year = yearValue.length === 2
      ? (Number(yearValue) < 50 ? 2000 + Number(yearValue) : 1900 + Number(yearValue))
      : Number(yearValue);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return { error: 'must be a valid date' };
    }
    return { value: date.toISOString().slice(0, 10) };
  }
  return { error: 'must be a valid date in YYYY-MM-DD or MM/DD/YYYY format' };
};

const lookupByIdOrName = (values, input, nameField) => {
  const value = cleanString(input);
  if (!value) return null;
  return values.find((item) => String(item.id) === value)
    || values.find((item) => String(item[nameField] || '').trim().toLowerCase() === value.toLowerCase())
    || null;
};

const readSpreadsheetRows = (file) => {
  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      const error = new Error('The uploaded spreadsheet does not contain a worksheet');
      error.statusCode = 400;
      throw error;
    }
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
    });
    if (!rows.length) {
      const error = new Error('The uploaded worksheet does not contain inventory rows');
      error.statusCode = 400;
      throw error;
    }
    return rows;
  } catch (error) {
    if (error.statusCode) throw error;
    const invalidFile = new Error('The uploaded file is not a readable Excel or CSV inventory spreadsheet');
    invalidFile.statusCode = 400;
    throw invalidFile;
  }
};

const importInventory = async (req, res, next) => {
  let transaction;
  try {
    const scope = getScope(req);
    const rows = req.file ? readSpreadsheetRows(req.file) : req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide at least one spreadsheet row' });
    }
    if (rows.length > 2000) {
      return res.status(413).json({ success: false, message: 'A maximum of 2,000 rows may be imported at a time' });
    }

    const collegeId = scope.collegeId;
    const [categories, departments, colleges, campuses] = await Promise.all([
      Category.findAll({ where: { status: 'active' } }),
      Department.findAll({
        where: req.user.role === 'admin' ? {} : { collegeId },
      }),
      College.findAll({ where: req.user.role === 'admin' ? {} : scope }),
      Campus.findAll({ where: { status: 'active' } }),
    ]);
    const categoryLookup = new Map(categories.map((item) => [String(item.name).trim().toLowerCase(), item]));
    const serials = rows.map((row) => cleanString(readField(row || {}, 'serialNumber'))).filter(Boolean);
    const assetCodes = rows.map((row) => cleanString(readField(row || {}, 'assetCode'))).filter(Boolean);
    const existingIdentifiers = serials.length || assetCodes.length
      ? await Asset.findAll({
        where: {
          [Op.or]: [
            ...(serials.length ? [{ serialNumber: { [Op.in]: [...new Set(serials)] } }] : []),
            ...(assetCodes.length ? [{ assetCode: { [Op.in]: [...new Set(assetCodes)] } }] : []),
          ],
        },
        attributes: ['serialNumber', 'assetCode'],
        raw: true,
      })
      : [];
    const existingSerialLookup = new Set(existingIdentifiers.map((item) => cleanString(item.serialNumber).toLowerCase()));
    const existingAssetCodeLookup = new Set(existingIdentifiers.map((item) => cleanString(item.assetCode).toLowerCase()));
    const fileSerialRows = new Map();
    serials.forEach((serial) => {
      const normalized = serial.toLowerCase();
      fileSerialRows.set(normalized, (fileSerialRows.get(normalized) || 0) + 1);
    });
    const fileAssetCodeRows = new Map();
    assetCodes.forEach((assetCode) => {
      const normalized = assetCode.toLowerCase();
      fileAssetCodeRows.set(normalized, (fileAssetCodeRows.get(normalized) || 0) + 1);
    });

    const results = rows.map((source, index) => {
      const row = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
      const errors = [];
      const record = {};
      const addError = (field, message) => errors.push({ field, message });
      const name = cleanString(readField(row, 'name'));
      const categoryName = cleanString(readField(row, 'category'));
      const departmentInput = readField(row, 'department') || readField(row, 'departmentId');
      const department = lookupByIdOrName(departments, departmentInput, 'name');
      const category = categoryLookup.get(categoryName.toLowerCase());

      if (!name) addError('name', 'Name is required');
      else if (name.length > 255) addError('name', 'Name must be 255 characters or fewer');
      if (!categoryName) addError('category', 'Category is required');
      else if (!category) addError('category', 'Category is not a valid active category');
      if (!departmentInput) addError('department', 'Department is required');
      else if (!department) addError('department', 'Department is not available in your authorized college');
      const location = cleanString(readField(row, 'location'));
      if (!location) addError('location', 'Location is required');

      const statusInput = cleanString(readField(row, 'status')) || 'available';
      const status = normalizedValue(statusInput);
      if (!ASSET_STATUS_VALUES.has(status)) addError('status', 'Status is not valid');

      const serialNumber = cleanString(readField(row, 'serialNumber'));
      const assetCode = cleanString(readField(row, 'assetCode'));
      const duplicateSerial = Boolean(serialNumber) && (
        existingSerialLookup.has(serialNumber.toLowerCase())
        || (fileSerialRows.get(serialNumber.toLowerCase()) || 0) > 1
      );
      const duplicateAssetId = Boolean(assetCode) && (
        existingAssetCodeLookup.has(assetCode.toLowerCase())
        || (fileAssetCodeRows.get(assetCode.toLowerCase()) || 0) > 1
      );
      const duplicate = duplicateSerial || duplicateAssetId;

      const dates = {};
      for (const field of ['purchaseDate', 'expiryDate', 'warrantyExpiry']) {
        const parsed = parseDate(readField(row, field));
        if (parsed.error) addError(field, parsed.error);
        dates[field] = parsed.value || null;
      }

      const purchasePriceValue = cleanString(readField(row, 'purchasePrice'));
      const purchasePrice = purchasePriceValue === '' ? 0 : Number(purchasePriceValue.replace(/,/g, ''));
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        addError('purchasePrice', 'Purchase price must be a non-negative number');
      }

      const quantityValue = cleanString(readField(row, 'quantity'));
      const quantity = quantityValue === '' ? 1 : Number(quantityValue);
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        addError('quantity', 'Quantity must be a positive integer');
      }

      const campusInput = readField(row, 'campus');
      const campus = lookupByIdOrName(campuses, campusInput, 'campusName');
      if (cleanString(campusInput) && !campus) addError('campus', 'Campus does not exist');
      const collegeInput = readField(row, 'college');
      const college = lookupByIdOrName(colleges, collegeInput, 'collegeName');
      if (cleanString(collegeInput) && !college) addError('college', 'College is not available in your authorized scope');
      if (department && college && Number(department.collegeId) !== Number(college.id)) {
        addError('college', 'College does not match the selected department');
      }
      if (department?.collegeId && campus?.id) {
        const departmentCollege = colleges.find((item) => Number(item.id) === Number(department.collegeId));
        if (departmentCollege?.campusId && Number(departmentCollege.campusId) !== Number(campus.id)) {
          addError('campus', 'Campus does not match the selected department');
        }
      }

      const strings = {
        serialNumber,
        condition: cleanString(readField(row, 'condition')) || 'Good',
        location,
        description: cleanString(readField(row, 'description')),
        manufacturer: cleanString(readField(row, 'manufacturer')),
        model: cleanString(readField(row, 'model')),
        supplier: cleanString(readField(row, 'supplier')),
      };
      for (const [field, value, maxLength] of [
        ['assetCode', assetCode, 255],
        ['serialNumber', strings.serialNumber, 255],
        ['condition', strings.condition, 100],
        ['location', strings.location, 255],
        ['manufacturer', strings.manufacturer, 255],
        ['model', strings.model, 255],
        ['supplier', strings.supplier, 255],
      ]) {
        if (value.length > maxLength) addError(field, `Must be ${maxLength} characters or fewer`);
      }

      Object.assign(record, {
        name,
        assetCode,
        serialNumber,
        category: category?.name || categoryName,
        department: department?.name || cleanString(departmentInput),
        departmentId: department?.id || null,
        collegeId: department?.collegeId || college?.id || collegeId || null,
        campusId: campus?.id || null,
        status,
        condition: strings.condition,
        location: strings.location,
        description: strings.description,
        manufacturer: strings.manufacturer,
        model: strings.model,
        supplier: strings.supplier,
        purchaseDate: dates.purchaseDate,
        expiryDate: dates.expiryDate,
        warrantyExpiry: dates.warrantyExpiry,
        purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : 0,
        quantity: Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1,
        createdBy: req.user.id,
      });

      return {
        row: index + 2,
        record,
        errors,
        duplicate,
        duplicateSerial,
        duplicateAssetId,
        valid: errors.length === 0 && !duplicate,
      };
    });

    const validRows = results.filter((item) => item.valid);
    const summary = {
      total: rows.length,
      imported: 0,
      rejected: rows.length - validRows.length,
      duplicates: results.filter((item) => item.duplicate).length,
      errors: results.filter((item) => item.errors.length > 0).length,
      valid: validRows.length,
    };
    const preview = req.body.preview === true || req.body.preview === 'true';
    if (preview || validRows.length === 0) {
      return res.json({
        success: true,
        preview,
        summary,
        results: results.map(({ row, errors, duplicate, duplicateSerial, duplicateAssetId, valid, record }) => ({
          row,
          errors,
          duplicate,
          duplicateSerial,
          duplicateAssetId,
          valid,
          record,
        })),
      });
    }

    transaction = await sequelize.transaction();
    const created = await Asset.bulkCreate(validRows.map((item) => item.record), {
      transaction,
      validate: true,
    });
    await AuditLog.create({
      userId: req.user.id,
      action: 'ICT_INVENTORY_IMPORT',
      entity: 'assets',
      details: JSON.stringify({
        total: summary.total,
        imported: created.length,
        rejected: summary.rejected,
        duplicates: summary.duplicates,
        errors: summary.errors,
      }),
    }, { transaction });
    await transaction.commit();
    summary.imported = created.length;
    return res.status(201).json({
      success: true,
      summary,
      results: results.map(({ row, errors, duplicate, duplicateSerial, duplicateAssetId, valid }) => ({
        row,
        errors,
        duplicate,
        duplicateSerial,
        duplicateAssetId,
        valid,
      })),
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

module.exports = { getInventory, importInventory };
