import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import type { SessionResponseDto } from './dto/session-response.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/interfaces/authenticated-user.interface';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Get()
  async findAll(
    @Query() query: ListSessionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionResponseDto[]> {
    return this.sessionsService.findAll(query, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionResponseDto> {
    return this.sessionsService.create(dto, user.id);
  }

  @Post('active')
  @HttpCode(HttpStatus.OK)
  async active(@CurrentUser() user: AuthenticatedUser): Promise<SessionResponseDto> {
    return this.sessionsService.beat(user.id);
  }
}
