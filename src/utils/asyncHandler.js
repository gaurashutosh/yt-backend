const asyncHandler = (incomingFuction) => {
  return (req, res, next) => {
    Promise.resolve(incomingFuction(req, res, next)).catch((err) => next(err));
  };
};

export {asyncHandler}