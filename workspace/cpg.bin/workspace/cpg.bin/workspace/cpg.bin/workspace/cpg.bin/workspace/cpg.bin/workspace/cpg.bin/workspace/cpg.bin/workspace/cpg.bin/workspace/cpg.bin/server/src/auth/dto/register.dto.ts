import { IsOptional, IsPhoneNumber, IsString, MinLength } from "class-validator";

export class RegisterUserDTO {
    @IsString()
    @MinLength(1)
    email!: string;

    @IsString()
    @MinLength(1)
    password!: string;

    @IsString()
    @IsOptional()
    name?: string | null;

    @IsPhoneNumber()
    @IsOptional()
    phone?: string | null;

    @IsString()
    @IsOptional()
    role?: string;
}