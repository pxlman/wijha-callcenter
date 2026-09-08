import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class ListSessionsQueryDto {
  @IsOptional()
  @IsNumberString()
  user_id?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  time?: string;
}
