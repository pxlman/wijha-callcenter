import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { LoginResponseDto, UserResponse } from '@/auth/dto/login-response.dto';
import type { AuthenticatedUser } from '@/common/interfaces/authenticated-user.interface';
import { RegisterUserDTO } from '@/auth/dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    if (user.role === 'deleted') {
      throw new UnauthorizedException('Deleted account cannot log in (please contact support)');
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { jwtToken: token }, // Store JWT token after successful login
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phoneNumber,
        role: user.role,
        has_profile_image: !!user.profileImage,
      },
    };
  }

  async register(dto: RegisterUserDTO): Promise<number> {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new UnauthorizedException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name ?? null,
        phoneNumber: dto.phone,
        role: dto.role ?? 'user', // Set a default role if not provided
      },
    });

    return user.id;
  }

  async validateUserWithToken(userId: number, token: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    if (user.jwtToken !== token) return null;
    return { id: user.id, email: user.email, role: user.role };
  }

  async logout(user: AuthenticatedUser): Promise<{message:string}> {
    let updated = (await this.prisma.user.update({where: {id: user.id}, data: {jwtToken: null}})).jwtToken;
    if(!updated){
      return { message: "Logged out successfully" };
    } else {
      return { message: "Something went wrong" };
    }
    
  }

  async getMe(user: AuthenticatedUser): Promise<UserResponse | null> {
    const existingUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!existingUser) return null;
    return { id: existingUser.id, email: existingUser.email, role: existingUser.role, name: existingUser.name, phone: existingUser.phoneNumber, has_profile_image: !!existingUser.profileImage };
  }
}
