const today = () => new Date().toISOString().slice(0, 10);

const calculateSoftwareLicenseStatus = (license, requestedStatus) => {
  const status = requestedStatus || license.status;
  if (['Suspended', 'Cancelled'].includes(status)) return status;
  if (!license.expiryDate) return 'Active';
  const expiry = new Date(`${license.expiryDate}T23:59:59.999Z`);
  const now = new Date(`${today()}T00:00:00.000Z`);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= 7) return 'Expiring Soon';
  return 'Active';
};

module.exports = { calculateSoftwareLicenseStatus };