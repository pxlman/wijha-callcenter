import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const { method, originalUrl, body, query, params } = req;
    console.log(`[${method}] ${originalUrl}`);
    // if (Object.keys(body).length > 0) {
    //   console.log('Body:', body);
    // }
    if (Object.keys(query).length > 0) {
      console.log('Query:', query);
    }
    if (Object.keys(params).length > 1) {
      console.log('Params:', params);
    }
    // if (Object.keys(res).length > 0) {
    //   console.log('Response:', res);
    // }
    next();
  }
}
