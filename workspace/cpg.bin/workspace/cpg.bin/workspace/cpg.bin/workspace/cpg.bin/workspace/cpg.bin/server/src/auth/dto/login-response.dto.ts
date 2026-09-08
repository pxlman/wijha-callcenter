export class UserResponse {
  id!: number;
  email!: string;
  name?: string | null;
  phone?: string | null;
  role!: string;
  has_profile_image!: boolean;
}

export class LoginResponseDto {
  token!: string;
  user!: UserResponse;
}
