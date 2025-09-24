import {
  Body,
  Controller,
  Post,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AppLogger } from 'src/common/logger/logger.service';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserDto } from 'src/users/dto/user.dto';
import { RegisterUserDto } from './dto/register.dto';
import { RefreshResponseDto } from './dto/refresh.dto';

const THROTTLE_LIMIT = Number(process.env.THROTTLE_LIMIT) || 1000;
const THROTTLE_TTL = Number(process.env.THROTTLE_TTL) || 60000;

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: AppLogger,
  ) {}

  // ---------------- Register ----------------
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered', type: UserDto })
  @ApiBody({ type: RegisterUserDto })
  async create(@Body() registerUserDto: RegisterUserDto): Promise<UserDto> {
    const user = await this.authService.registerUser(
      registerUserDto.name,
      registerUserDto.email,
      registerUserDto.password,
    );
    return Object.assign(new UserDto(), user);
  }

  // ---------------- Login ----------------
  @Post('login')
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceId = body.deviceId || 'default';
    const tokens = await this.authService.login(
      await this.authService.validateUser(body.email, body.password),
      deviceId,
    );

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    this.logger.infoJson('User login successful', 'AuthController', {
      deviceId,
    });
    return { access_token: tokens.access_token };
  }

  // ---------------- Refresh ----------------
  @Post('refresh')
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  async refresh(
    @Res({ passthrough: true }) res: Response,
    @Body('deviceId') deviceId: string = 'default',
  ): Promise<RefreshResponseDto> {
    const refreshToken = res.req.cookies['refresh_token'];
    if (!refreshToken) {
      this.logger.warnJson('Refresh token missing', 'AuthController', {
        deviceId,
      });
      throw new UnauthorizedException('No refresh token');
    }

    const payload = this.authService.verifyRefreshToken(refreshToken);
    const tokensWithUser = await this.authService.refresh(
      payload.sub,
      refreshToken,
      deviceId,
    );

    res.cookie('refresh_token', tokensWithUser.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return tokensWithUser;
  }

  // ---------------- Logout ----------------
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(
    @Request() req: { user: { userId: string } },
    @Body('deviceId') deviceId: string = 'default',
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.userId, deviceId);
    res.clearCookie('refresh_token');

    this.logger.infoJson('User logged out', 'AuthController', {
      userId: req.user.userId,
      deviceId,
    });
    return { message: 'Logged out successfully' };
  }
}
