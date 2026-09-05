export const getDepartmentLabel = (department) => {
  if (department && typeof department === 'object') {
    return department.name || department.code || '';
  }

  return department || '';
};
