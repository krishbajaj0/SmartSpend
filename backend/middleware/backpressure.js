/**
 * @file middleware/backpressure.js
 * @description Load shedding middleware to protect DB connection pools and event loop.
 */

export function createConcurrencyLimiter(limit, name = 'global') {
  let active = 0;

  return (req, res, next) => {
    if (active >= limit) {
      return res.status(503).json({
        success: false,
        error: 'Server overloaded',
        type: name
      });
    }

    active++;
    if (name === 'global') {
      req.app.locals.activeRequests = active;
    }

    let done = false;
    const cleanup = () => {
      if (!done) {
        active--;
        if (name === 'global') {
          req.app.locals.activeRequests = active;
        }
        done = true;
      }
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    next();
  };
}

const userMap = new Map();

export function analyticsUserLimiter(limit = 1) {
  return (req, res, next) => {
    const userId = req.user?._id?.toString();
    if (!userId) return next();

    const count = userMap.get(userId) || 0;

    if (count >= limit) {
      return res.status(429).json({
        success: false,
        error: 'Too many analytics requests'
      });
    }

    userMap.set(userId, count + 1);

    const cleanup = () => {
      const current = userMap.get(userId) || 1;
      userMap.set(userId, current - 1);
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);

    next();
  };
}
