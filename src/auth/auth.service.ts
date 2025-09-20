import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from 'src/users/schemas/user.schema';
import { TokenResponseDto } from './dto/token-response.dto';
import { Types } from 'mongoose';
import { AppLogger } from 'src/common/logger/logger.service';

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
    private readonly logger: AppLogger,
  ) {
    const authConfig = configService.get('auth');
    this.accessSecret = authConfig.jwtAccessSecret;
    this.refreshSecret = authConfig.jwtRefreshSecret;
    this.accessTokenExpiresIn = authConfig.jwtAccessExpiresIn;
    this.refreshTokenExpiresIn = authConfig.jwtRefreshExpiresIn;
    this.refreshTokenCacheTtl = authConfig.refreshTokenTtl;
  }

  // ------------------- Validate user -------------------
  async validateUser(email: string, password: string): Promise<UserDocument> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warnJson('Invalid login attempt', 'AuthService', { email });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warnJson('Invalid password attempt', 'AuthService', {
        email,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.infoJson('User validated successfully', 'AuthService', {
      email,
    });
    return user;
  }

  // ------------------- Login -------------------
  async login(user: UserDocument, deviceId: string): Promise<TokenResponseDto> {
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

    const hashed = this.hashToken(refresh_token);
    await this.cacheManager.set(
      `refresh_${payload.sub}_${deviceId}`,
      hashed,
      this.refreshTokenCacheTtl,
    );

    this.logger.infoJson('User login', 'AuthService', {
      userId: payload.sub,
      deviceId,
    });

    return { access_token, refresh_token };
  }

  // ------------------- Refresh -------------------
  async refresh(
    userId: string,
    refreshToken: string,
    deviceId: string,
  ): Promise<TokenResponseDto> {
    const key = `refresh_${userId}_${deviceId}`;
    const storedHash = await this.cacheManager.get<string>(key);

    if (!storedHash || storedHash !== this.hashToken(refreshToken)) {
      this.logger.errorJson(
        'Refresh token verification failed',
        'AuthService',
        { userId, deviceId },
      );
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

    await this.cacheManager.set(
      key,
      this.hashToken(newRefreshToken),
      this.refreshTokenCacheTtl,
    );

    this.logger.infoJson('Refresh token rotated', 'AuthService', {
      userId,
      deviceId,
    });

    return { access_token: newAccessToken, refresh_token: newRefreshToken };
  }

  // ------------------- Logout -------------------
  async logout(userId: string, deviceId: string): Promise<void> {
    await this.cacheManager.del(`refresh_${userId}_${deviceId}`);
    this.logger.infoJson('User logged out', 'AuthService', {
      userId,
      deviceId,
    });
  }

  // ------------------- Helpers -------------------
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  verifyRefreshToken(token: string): LoginPayload {
    try {
      return this.jwtService.verify<LoginPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      this.logger.warnJson('Refresh token verification failed', 'AuthService');
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
