const isValidEmail = (email) => typeof email === 'string' && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(email.trim());
const isValidUsername = (username) => typeof username === 'string' && username.trim().length >= 3;

module.exports = { isValidEmail, isValidUsername };
