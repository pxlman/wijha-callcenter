import { IsOptional, IsString, IsNumber } from 'class-validator';

export class NotifyCallingDto {
  @IsNumber()
  client_id!: number;

  @IsOptional()
  @IsNumber()
  project_id?: number;

  @IsOptional()
  @IsString()
  client_number?: string;
}
