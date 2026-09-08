import { IsOptional, IsString } from 'class-validator';

export class OwnerInfoDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  value?: string;
}
