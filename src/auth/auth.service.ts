import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserDocument } from 'src/users/schemas/user.schema';
import { ConfigService } from '@nestjs/config';
import { TokenResponseDto } from './dto/token-response.dto';
import { Types } from 'mongoose';

interface LoginPayload {
  sub: string;
  email?: string;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly refreshTokenCacheTtl: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    const authConfig = this.configService.get('auth');
    this.jwtSecret = authConfig.jwtSecret;
    this.accessTokenExpiresIn = authConfig.jwtAccessExpiresIn;
    this.refreshTokenExpiresIn = authConfig.jwtRefreshExpiresIn;
    this.refreshTokenCacheTtl = authConfig.refreshTokenTtl;
  }

  async validateUser(email: string, password: string): Promise<UserDocument> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  async login(user: UserDocument): Promise<TokenResponseDto> {
    const payload: LoginPayload = {
      sub: (user._id as Types.ObjectId).toString(),
      email: user.email,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.accessTokenExpiresIn,
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.refreshTokenExpiresIn,
    });

    await this.cacheManager.set(
      `refresh_${(user._id as Types.ObjectId).toString()}`,
      refresh_token,
      this.refreshTokenCacheTtl,
    );

    return { access_token, refresh_token };
  }

  async refresh(
    userId: string,
    refreshToken: string,
  ): Promise<TokenResponseDto> {
    const storedToken = await this.cacheManager.get<string>(
      `refresh_${userId}`,
    );
    if (!storedToken || storedToken !== refreshToken)
      throw new UnauthorizedException('Invalid refresh token');

    const payload: LoginPayload = { sub: userId };
    const newAccessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.accessTokenExpiresIn,
    });
    const newRefreshToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.refreshTokenExpiresIn,
    });

    await this.cacheManager.set(
      `refresh_${userId}`,
      newRefreshToken,
      this.refreshTokenCacheTtl,
    );

    return { access_token: newAccessToken, refresh_token: newRefreshToken };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.cacheManager.del(`refresh_${userId}`);
    return { message: 'Logged out successfully' };
  }
}
