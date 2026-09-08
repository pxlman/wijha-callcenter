import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class ListOwnersQueryDto {
  @IsNumberString()
  @IsOptional()
  project_id?: string;

  @IsNumberString()
  @IsOptional()
  agent_id?: string;

  /**
   * Filter by Client.type — one of: OWNER, LEAD, BOTH
   */
  @IsOptional()
  @IsString()
  type?: string;

  /**
   * Filter by ClientProject.status — e.g. dial, callback, answered, not_interested
   */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
