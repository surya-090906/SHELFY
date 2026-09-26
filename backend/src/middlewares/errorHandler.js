const errorHandler = (err, req, res, next) => {
  if (!err.statusCode && !['P2002', 'P2003', 'P2025'].includes(err.code)) console.error('Server error:', err.message);

  const statusCode = err.statusCode || (err.code === 'P2002' ? 409 : ['P2003', 'P2025'].includes(err.code) || err.name === 'PrismaClientValidationError' ? 400 : 500);
  const message = err.code === 'P2002' ? 'This Login Id, email, SKU or short code is already in use' : err.code === 'P2003' ? 'This record is referenced by inventory documents' : err.code === 'P2025' ? 'Record not found' : statusCode === 500 ? 'An unexpected server error occurred' : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
