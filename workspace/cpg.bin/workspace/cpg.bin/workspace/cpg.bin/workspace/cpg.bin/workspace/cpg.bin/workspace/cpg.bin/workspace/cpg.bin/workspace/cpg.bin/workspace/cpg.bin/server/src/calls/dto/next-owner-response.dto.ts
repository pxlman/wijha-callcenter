import type { OwnerResponseDto } from '@/owners/dto/owner-response.dto';
import type { CallResponseDto } from './call-response.dto';

export class NextOwnerResponseDto {
  owner!: OwnerResponseDto;
  calls!: CallResponseDto[];
}