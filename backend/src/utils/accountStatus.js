const isAccountActive = (active) => active === true
  || active === 1
  || active === '1'
  || (typeof active === 'string' && active.trim().toLowerCase() === 'true');

module.exports = { isAccountActive };
