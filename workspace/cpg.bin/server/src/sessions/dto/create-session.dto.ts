import { IsDateString } from 'class-validator';

export class CreateSessionDto {
  @IsDateString()
  first_beat!: string;

  @IsDateString()
  last_beat!: string;
}
