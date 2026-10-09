import { Request, Response, NextFunction } from "express";
import NodeCache from "node-cache";

// StdTTL is 5 minutes by default
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

export const cacheMiddleware = (duration?: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    } else {
      // Overwrite res.json to cache the body before sending it
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        // We only cache if status code is 200 (OK)
        if (res.statusCode === 200) {
          cache.set(key, body, duration || 300);
        }
        return originalJson(body);
      };
      next();
    }
  };
};
