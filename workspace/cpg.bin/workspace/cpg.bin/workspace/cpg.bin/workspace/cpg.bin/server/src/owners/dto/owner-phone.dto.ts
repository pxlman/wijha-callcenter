import { IsPhoneNumber } from 'class-validator';

export class OwnerPhoneDto {
  @IsPhoneNumber('EG')
  phone!: string;
}
