import { IsOptional, IsString, IsBooleanString } from 'class-validator';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBooleanString()
  online?: string;
}
