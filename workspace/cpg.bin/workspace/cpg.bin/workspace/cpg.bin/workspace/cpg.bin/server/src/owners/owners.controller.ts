import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { OwnersService } from './owners.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { BulkCreateOwnersDto } from './dto/bulk-create-owners.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { AssignProjectDto } from './dto/assign-project.dto';
import { ListOwnersQueryDto } from './dto/list-owners-query.dto';
import type { OwnerResponseDto } from './dto/owner-response.dto';
import type { StatusCountDto } from '@/calls/dto/status-count.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('owners')
@UseGuards(JwtAuthGuard)
export class OwnersController {
  constructor(private ownersService: OwnersService) {}

  @Get()
  async findAll(@Query() query: ListOwnersQueryDto): Promise<{
    data: OwnerResponseDto[];
    meta: { total: number; page: number; limit: number };
  }> {
    const projectId = query.project_id ? Number(query.project_id) : undefined;
    const agentId = query.agent_id ? Number(query.agent_id) : undefined;
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Math.min(Number(query.limit), 100) : 20;
    return this.ownersService.findAll(projectId, query.type, query.status, page, limit, agentId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOwnerDto): Promise<OwnerResponseDto> {
    return this.ownersService.create(dto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async createBulk(@Body() dto: BulkCreateOwnersDto): Promise<OwnerResponseDto[]> {
    return this.ownersService.createBulk(dto.owners);
  }

  @Get('statuses')
  async getStatuses(): Promise<StatusCountDto[]> {
    return this.ownersService.getStatusCounts();
  }

  @Post(':ownerId/projects')
  @HttpCode(HttpStatus.OK)
  async assignProject(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() dto: AssignProjectDto,
  ): Promise<OwnerResponseDto> {
    return this.ownersService.assignToProject(ownerId, dto.project_name);
  }

  @Get(':ownerId')
  async findOne(@Param('ownerId', ParseIntPipe) ownerId: number): Promise<OwnerResponseDto | null> {
    return this.ownersService.findById(ownerId);
  }

  @Patch(':ownerId')
  async patch(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() dto: UpdateOwnerDto,
  ): Promise<OwnerResponseDto> {
    return this.ownersService.update(ownerId, dto);
  }

  @Delete(':ownerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('ownerId', ParseIntPipe) ownerId: number): Promise<void> {
    return this.ownersService.remove(ownerId);
  }
}
