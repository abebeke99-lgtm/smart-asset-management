export const getPasswordIssue = (password) => {
  if (typeof password !== 'string' || password.length === 0) return 'required';
  if (password.length < 8 || password.length > 16) return 'length';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'composition';
  return null;
};

export const getPasswordConfirmationIssue = (password, confirmation) => {
  if (typeof confirmation !== 'string' || confirmation.length === 0) return 'required';
  return password === confirmation ? null : 'mismatch';
};

export const PASSWORD_VALIDATION_MESSAGES = {
  required: 'Password is required.',
  length: 'Password must be 8–16 characters long.',
  composition: 'Password must contain at least one letter and one number.',
  mismatch: 'Passwords do not match.',
  confirmRequired: 'Confirm Password is required.',
};
