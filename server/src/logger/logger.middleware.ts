import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    const { method, originalUrl, body, query, params } = req;
    const start = Date.now();

    console.log(`[${method}] ${originalUrl}`);
    // if (Object.keys(body).length > 0) {
    //   console.log('Body:', body);
    // }
    if (Object.keys(query).length > 0) {
      console.log('Query:', query);
    }
    if (params && Object.keys(params).length > 1) {
      console.log('Params:', params);
    }
    // if (Object.keys(res).length > 0) {
    //   console.log('Response:', res);
    // }
    next();
  }
}
