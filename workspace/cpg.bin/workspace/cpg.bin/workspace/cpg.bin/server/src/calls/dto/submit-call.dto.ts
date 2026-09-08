import { IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';

export class SubmitCallDto {
  @IsNumber()
  client_id!: number;

  @IsString()
  status!: string;

  @IsDateString()
  time!: string;

  @IsOptional()
  @IsNumber()
  project_id?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  agent_notes?: string;

  @IsOptional()
  @IsDateString()
  next_dial_at?: string;
}
