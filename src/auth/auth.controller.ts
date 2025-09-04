import {
  Body,
  Controller,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private jwtService: JwtService,
  ) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.validationUser(
      body.email,
      body.password,
    );
    return this.authService.login(user);
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token: string }) {
    try {
      const payload = this.jwtService.verify(body.refresh_token);
      return this.authService.refresh(payload.sub, body.refresh_token);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Request() req) {
    return this.authService.logout(req.user.userId);
  }
}
