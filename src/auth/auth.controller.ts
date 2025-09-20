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

const THROTTLE_LIMIT = Number(process.env.THROTTLE_LIMIT) || 10;
const THROTTLE_TTL = Number(process.env.THROTTLE_TTL) || 60000;

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: AppLogger,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceId = body.deviceId || 'default';
    const user = await this.authService.validateUser(body.email, body.password);
    const tokens = await this.authService.login(user, deviceId);

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    this.logger.infoJson('User login successful', 'AuthController', {
      userId: user._id,
      email: user.email,
      deviceId,
    });

    return { access_token: tokens.access_token };
  }

  @Post('refresh')
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  async refresh(
    @Res({ passthrough: true }) res: Response,
    @Body('deviceId') deviceId: string = 'default',
  ) {
    const refreshToken = res.req.cookies['refresh_token'];
    if (!refreshToken) {
      this.logger.warnJson('Refresh token missing', 'AuthController', {
        deviceId,
      });
      throw new UnauthorizedException('No refresh token');
    }

    const payload = this.authService.verifyRefreshToken(refreshToken);
    const tokens = await this.authService.refresh(
      payload.sub,
      refreshToken,
      deviceId,
    );

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    this.logger.infoJson('Refresh token successful', 'AuthController', {
      userId: payload.sub,
      deviceId,
    });

    return { access_token: tokens.access_token };
  }

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
