import { Catch, ExceptionFilter, ArgumentsHost, NotFoundException, RequestTimeoutException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, _host: ArgumentsHost): void {
    if (exception.code === 'P2025') {
      throw new NotFoundException('Resource not found');
    }
    if (exception.code === 'P2028') {
      throw new RequestTimeoutException('Transaction timed out');
    }
    throw exception;
  }
}
