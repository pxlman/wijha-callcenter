export class UserStatsDto {
  total_calls!: number;
  answered!: number;
  no_answer!: number;
  busy!: number;
  failed!: number;
  callback!: number;
  avg_duration_seconds!: number;
  total_session_time_seconds!: number;
}
