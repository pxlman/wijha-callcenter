import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OwnerPhoneDto } from './owner-phone.dto';
import { OwnerInfoDto } from './owner-info.dto';

export class CreateOwnerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @IsOptional()
  project_id?: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  agent_id?: number;

  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => OwnerPhoneDto)
  phones!: OwnerPhoneDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OwnerInfoDto)
  info?: OwnerInfoDto[];
}
