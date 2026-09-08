import { ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOwnerDto } from './create-owner.dto';

export class BulkCreateOwnersDto {
  @ValidateNested({ each: true })
  @ArrayNotEmpty()
  @Type(() => CreateOwnerDto)
  owners!: CreateOwnerDto[];
}
