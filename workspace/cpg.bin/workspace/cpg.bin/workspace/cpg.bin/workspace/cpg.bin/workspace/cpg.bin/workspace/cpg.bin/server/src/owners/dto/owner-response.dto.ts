export class OwnerPhoneResponse {
  phone!: string;
}

export class OwnerInfoResponse {
  key!: string;
  value!: string;
}

export class ProjectAssignmentResponse {
  project_id!: number;
  project_name!: string;
  status?: string;
  attempt_count?: number;
  last_dialed_at?: string | null;
}

export class OwnerResponseDto {
  id!: number;
  name?: string;
  type?: string;
  next_dial_at?: string | null;
  agent_id?: number;
  phones?: OwnerPhoneResponse[];
  info?: OwnerInfoResponse[];
  projects?: ProjectAssignmentResponse[];
}
