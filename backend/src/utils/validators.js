const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidUsername = (username) => typeof username === 'string' && username.trim().length >= 3;

module.exports = { isValidEmail, isValidUsername };
