import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Stra188FetchService } from './stra188-fetch.service';
import { FETCH_ENDPOINTS } from './stra188-fetch.config';

function resolvePath(path: string): string {
  const p = path.split('?')[0] || '/';
  const clean = p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
  return clean.startsWith('/') ? clean : '/' + clean;
}

function toCanonicalPath(path: string): string {
  const resolved = resolvePath(path);
  if (resolved.startsWith('/api/')) return resolved;
  return '/api' + (resolved.startsWith('/') ? resolved : '/' + resolved);
}

@Injectable()
export class Stra188FetchMiddleware implements NestMiddleware {
  constructor(private readonly fetchService: Stra188FetchService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') {
      return next();
    }
    
    const path = resolvePath(req.path);
    const canonicalPath = path.startsWith('/api/') ? path : toCanonicalPath(path);
    const endpoint = FETCH_ENDPOINTS.find((e) => e.path === canonicalPath);
    if (!endpoint) return next();
    try {
      if (req.method !== endpoint.method) {
        res.status(200).json({});
        return;
      }
      const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : undefined;
      const data = await this.fetchService.getCached(endpoint, query);
      res.status(200).json(data);
    } catch {
      res.status(200).json({});
    }
  }
}
