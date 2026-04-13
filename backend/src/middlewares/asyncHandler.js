/**
 * Express 4 : propage les erreurs des handlers async vers errorHandler.
 */
export function asyncHandler(fn) {
  return function handler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
