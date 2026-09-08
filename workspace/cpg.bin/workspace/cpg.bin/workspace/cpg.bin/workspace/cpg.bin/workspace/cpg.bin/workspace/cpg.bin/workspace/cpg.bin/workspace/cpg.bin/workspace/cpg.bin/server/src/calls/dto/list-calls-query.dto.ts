import { IsOptional, IsString, IsNumberString, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ListCallsQueryDto {
  @IsOptional()
  @IsNumberString()
  client_id?: string;

  @IsOptional()
  @IsNumberString()
  agent_id?: string;

  @IsOptional()
  @IsNumberString()
  project_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  from?: Date;

  @IsOptional()
  @IsDateString()
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
