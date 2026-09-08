import { IsInt, IsOptional, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { OwnerPhoneDto } from './owner-phone.dto';
import { OwnerInfoDto } from './owner-info.dto';

export class UpdateOwnerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  agent_id?: number;

  @IsOptional()
  @IsString()
  next_dial_at?: string | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => OwnerPhoneDto)
  phones?: OwnerPhoneDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OwnerInfoDto)
  info?: OwnerInfoDto[];
}
