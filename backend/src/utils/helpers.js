const getErrorMessage = (err) => err?.message || 'Something went wrong';

const successResponse = (res, data, message = 'Success') => {
  res.json({ success: true, message, data });
};

const errorResponse = (res, status = 400, message = 'Error') => {
  res.status(status).json({ success: false, message });
};

module.exports = { getErrorMessage, successResponse, errorResponse };
