export class ProjectRef {
  id!: number;
  name!: string;
}

export class CallResponseDto {
  id!: number;
  client_id!: number;
  agent_id!: number;
  status!: string;
  time!: string;
  duration?: number | null;
  agent_notes?: string | null;
  projects!: ProjectRef[];
}
