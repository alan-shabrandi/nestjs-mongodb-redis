import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
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
    this.accessSecret = authConfig.jwtAccessSecret;
    this.refreshSecret = authConfig.jwtRefreshSecret;
    this.accessTokenExpiresIn = authConfig.jwtAccessExpiresIn;
    this.refreshTokenExpiresIn = authConfig.jwtRefreshExpiresIn;
    this.refreshTokenCacheTtl = authConfig.refreshTokenTtl;
  }

  // ------------------- [Login Validation + Brute Force] -------------------
  async validateUser(email: string, password: string): Promise<UserDocument> {
    const key = `login_attempts:${email}`;
    const attempts = (await this.cacheManager.get<number>(key)) || 0;

    if (attempts >= 5) {
      throw new UnauthorizedException('Too many login attempts. Try later.');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      await this.cacheManager.set(key, attempts + 1, 15 * 60 * 1000); // 15 دقیقه قفل
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.cacheManager.set(key, attempts + 1, 15 * 60 * 1000);
      throw new UnauthorizedException('Invalid email or password');
    }

    // موفقیت → ریست تلاش‌ها
    await this.cacheManager.del(key);
    return user;
  }

  // ------------------- [Login] -------------------
  async login(user: UserDocument): Promise<TokenResponseDto> {
    const payload: LoginPayload = {
      sub: (user._id as Types.ObjectId).toString(),
      email: user.email,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTokenExpiresIn,
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTokenExpiresIn,
    });

    // هش کردن refresh token قبل از ذخیره
    const hashed = this.hashToken(refresh_token);
    await this.cacheManager.set(
      `refresh_${payload.sub}`,
      hashed,
      this.refreshTokenCacheTtl,
    );

    return { access_token, refresh_token };
  }

  // ------------------- [Refresh Token] -------------------
  async refresh(
    userId: string,
    refreshToken: string,
  ): Promise<TokenResponseDto> {
    const storedHash = await this.cacheManager.get<string>(`refresh_${userId}`);
    if (!storedHash || storedHash !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload: LoginPayload = { sub: userId };

    const newAccessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTokenExpiresIn,
    });

    const newRefreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTokenExpiresIn,
    });

    // invalidate قبلی و ذخیره هش جدید
    await this.cacheManager.set(
      `refresh_${userId}`,
      this.hashToken(newRefreshToken),
      this.refreshTokenCacheTtl,
    );

    return { access_token: newAccessToken, refresh_token: newRefreshToken };
  }

  // ------------------- [Logout] -------------------
  async logout(userId: string): Promise<{ message: string }> {
    await this.cacheManager.del(`refresh_${userId}`);
    return { message: 'Logged out successfully' };
  }

  // ------------------- [Helper] -------------------
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
