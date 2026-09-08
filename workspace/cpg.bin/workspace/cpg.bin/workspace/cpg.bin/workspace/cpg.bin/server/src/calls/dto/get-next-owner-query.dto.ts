import { IsDateString, IsNumberString, IsOptional, IsBooleanString, IsIn } from 'class-validator';

export class GetNextClientQueryDto {
  @IsOptional()
  @IsNumberString()
  project_id?: string;

  @IsOptional()
  @IsBooleanString()
  assigned_only?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(['OWNER', 'LEAD', 'BOTH'])
  type?: 'OWNER' | 'LEAD' | 'BOTH';
}
