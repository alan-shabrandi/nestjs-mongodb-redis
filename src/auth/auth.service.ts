import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async validationUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.cacheManager.set(
      `refresh_${user._id}`,
      refreshToken,
      7 * 24 * 60 * 60,
    );

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refresh(userId: string, refreshToken: string) {
    const storedToken = await this.cacheManager.get<string>(
      `refresh_${userId}`,
    );
    if (storedToken !== refreshToken)
      throw new UnauthorizedException('Invalid refresh token');

    const payload = { sub: userId };
    const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const newRefreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.cacheManager.set(
      `refresh_${userId}`,
      newRefreshToken,
      7 * 24 * 60 * 60,
    );
    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  async logout(userId: string) {
    await this.cacheManager.del(`refresh_${userId}`);
    return { message: 'Logged out successfully' };
  }
}
