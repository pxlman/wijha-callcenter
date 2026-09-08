import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { SubmitCallDto } from './dto/submit-call.dto';
import { NotifyCallingDto } from './dto/notify-calling.dto';
import { ListCallsQueryDto } from './dto/list-calls-query.dto';
import { GetNextClientQueryDto } from './dto/get-next-owner-query.dto';
import { GetStatusesQueryDto } from './dto/get-statuses-query.dto';
import type { CallResponseDto } from './dto/call-response.dto';
import type { NextOwnerResponseDto } from './dto/next-owner-response.dto';
import type { StatusCountDto } from './dto/status-count.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/interfaces/authenticated-user.interface';
import { DEFAULT_PAGE_LIMIT } from './config';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private callsService: CallsService) {}

  @Get()
  async findAll(@Query() query: ListCallsQueryDto): Promise<{
    data: CallResponseDto[];
    meta: { total: number; page: number; limit: number };
  }> {
    const clientId = query.client_id ? Number(query.client_id) : undefined;
    const agentId = query.agent_id ? Number(query.agent_id) : undefined;
    const projectId = query.project_id ? Number(query.project_id) : undefined;
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    return this.callsService.findAll({
      client_id: clientId,
      agent_id: agentId,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? DEFAULT_PAGE_LIMIT,
      from,
      to,
      project_id: projectId,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @Body() dto: SubmitCallDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CallResponseDto> {
    return this.callsService.submit(dto, user.id);
  }

  @Get('next')
  async getNext(
    @Query() query: GetNextClientQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NextOwnerResponseDto | null> {
    const assignedOnly = query.assigned_only === 'true' || query.assigned_only === '1';
    return this.callsService.getNextOwner({
      projectId: query.project_id && query.project_id !== '0' ? Number(query.project_id) : undefined,
      date: query.date ? new Date(query.date) : undefined,
      agentId: assignedOnly ? user.id : undefined,
      type: query.type,
    });
  }

  @Get('statuses')
  async getStatuses(@Query() query: GetStatusesQueryDto): Promise<StatusCountDto[]> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    return this.callsService.getStatusCounts(from, to);
  }

  @Post('calling')
  @HttpCode(HttpStatus.OK)
  async notifyCalling(@Body() dto: NotifyCallingDto): Promise<void> {
    await this.callsService.notifyCalling(dto);
  }

  @Get(':callId')
  async findOne(@Param('callId', ParseIntPipe) callId: number): Promise<CallResponseDto | null> {
    return this.callsService.findById(callId);
  }
}
