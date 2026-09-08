import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { OwnersModule } from '@/owners/owners.module';

@Module({
  imports: [OwnersModule],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}
