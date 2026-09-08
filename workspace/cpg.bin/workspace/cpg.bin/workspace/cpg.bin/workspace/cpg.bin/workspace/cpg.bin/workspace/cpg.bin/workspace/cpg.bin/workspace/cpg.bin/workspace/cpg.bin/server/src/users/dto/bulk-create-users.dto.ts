import { ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

export class BulkCreateUsersDto {
  @ValidateNested({ each: true })
  @ArrayNotEmpty()
  @Type(() => CreateUserDto)
  users!: CreateUserDto[];
}
