import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { TokenResponseDto } from './dto/token-response.dto';
import { Types } from 'mongoose';
import { AppLogger } from 'src/common/logger/logger.service';
import { RefreshResponseDto } from './dto/refresh.dto';
import { UserDto } from 'src/users/dto/user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtPayload } from './jwt.strategy';

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
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

  // ------------------- Register -------------------
  async registerUser(
    name: string,
    email: string,
    password: string,
  ): Promise<User> {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) throw new BadRequestException('Email already exists');

    const hashedPassword = await this.usersService.hashPassword(password);
    const newUser = new this.userModel({
      name,
      email,
      password: hashedPassword,
    });
    return (await newUser.save()).toObject();
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

    const key = `refresh_${payload.sub}_${deviceId}`;

    await this.cacheManager.set(
      key,
      {
        hashedRefreshToken: this.hashToken(refresh_token),
        accessToken: access_token,
      },
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
  ): Promise<RefreshResponseDto> {
    const key = `refresh_${userId}_${deviceId}`;
    const cached = await this.cacheManager.get<{
      hashedRefreshToken: string;
      accessToken: string;
    }>(key);

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const userDto = new UserDto();
    Object.assign(userDto, user.toObject());

    const now = Math.floor(Date.now() / 1000);

    if (cached && cached.hashedRefreshToken === this.hashToken(refreshToken)) {
      const decoded = this.jwtService.decode(cached.accessToken);
      if (decoded && decoded.exp && decoded.exp > now) {
        this.logger.infoJson('Cached access token still valid', 'AuthService', {
          userId,
          deviceId,
        });
        return {
          access_token: cached.accessToken,
          refresh_token: refreshToken,
          user: userDto,
        };
      }
    }

    const payload: LoginPayload = { sub: userId };

    const newAccessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTokenExpiresIn,
    });

    let newRefreshToken = refreshToken;
    try {
      this.verifyRefreshToken(refreshToken);
    } catch {
      newRefreshToken = this.jwtService.sign(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshTokenExpiresIn,
      });
    }

    // ذخیره مجدد در cache
    await this.cacheManager.set(
      key,
      {
        hashedRefreshToken: this.hashToken(newRefreshToken),
        accessToken: newAccessToken,
      },
      this.refreshTokenCacheTtl,
    );

    this.logger.infoJson('Access token refreshed', 'AuthService', {
      userId,
      deviceId,
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      user: userDto,
    };
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
