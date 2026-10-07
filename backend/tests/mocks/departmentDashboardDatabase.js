const createModel = () => ({
  findAll: jest.fn(async () => []),
  findOne: jest.fn(async () => null),
  findByPk: jest.fn(async () => null),
  count: jest.fn(async () => 0),
  create: jest.fn(),
  update: jest.fn(),
});

const models = {
  Asset: createModel(),
  User: createModel(),
  Department: createModel(),
  Location: createModel(),
  College: createModel(),
  Building: createModel(),
  Campus: createModel(),
  Approval: createModel(),
  Assignment: createModel(),
  Transfer: createModel(),
  AssetReturn: createModel(),
  Maintenance: createModel(),
  VerificationSession: createModel(),
  VerificationItem: createModel(),
  ServiceRequest: createModel(),
  AuditLog: createModel(),
  AssetMovement: createModel(),
  Room: createModel(),
  Config: createModel(),
};

const resetDashboardDatabase = () => {
  Object.values(models).forEach((model) => {
    Object.values(model).forEach((method) => {
      if (jest.isMockFunction(method)) method.mockReset();
    });
    model.findAll.mockResolvedValue([]);
    model.findOne.mockResolvedValue(null);
    model.findByPk.mockResolvedValue(null);
    model.count.mockResolvedValue(0);
    model.create.mockImplementation(() => {
      throw new Error('Unexpected database create in dashboard API test');
    });
    model.update.mockImplementation(() => {
      throw new Error('Unexpected database update in dashboard API test');
    });
  });

  models.User.findByPk.mockImplementation(async (id) => {
    if (Number(id) === 1) {
      return { id: 1, role: 'department_head', departmentId: 11, sessionVersion: 0, active: true };
    }
    if (Number(id) === 2) {
      return { id: 2, role: 'ict_officer', departmentId: 11, sessionVersion: 0, active: true };
    }
    return null;
  });
  models.Department.findOne.mockImplementation(async ({ where }) => (
    Number(where?.id) === 11
      ? { id: 11, name: 'Engineering', code: 'ENG', collegeId: 3, status: 'active' }
      : null
  ));
  models.Config.findByPk.mockResolvedValue(null);
};

resetDashboardDatabase();

module.exports = { ...models, resetDashboardDatabase };
