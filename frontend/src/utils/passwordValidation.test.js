import { getPasswordConfirmationIssue, getPasswordIssue } from './passwordValidation';

describe('password validation', () => {
  it.each([
    ['Abc12345', null],
    ['Abc1234567890123', null],
    ['Abc1234', 'length'],
    ['Abc12345678901234', 'length'],
    ['abcdefgh', 'composition'],
    ['12345678', 'composition'],
    ['', 'required'],
    ['Abc1234567890123 ', 'length'],
  ])('validates password %s', (password, expectedIssue) => {
    expect(getPasswordIssue(password)).toBe(expectedIssue);
  });

  it('requires an exact, nonempty confirmation match', () => {
    expect(getPasswordConfirmationIssue('Abc12345', 'Abc12345')).toBeNull();
    expect(getPasswordConfirmationIssue('Abc12345', 'Abc12346')).toBe('mismatch');
    expect(getPasswordConfirmationIssue('Abc12345', '')).toBe('required');
    expect(getPasswordConfirmationIssue('Abc12345 ', 'Abc12345')).toBe('mismatch');
  });
});
