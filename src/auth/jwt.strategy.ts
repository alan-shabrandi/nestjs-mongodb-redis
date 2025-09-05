import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from 'src/users/schemas/user.schema';
import { Types } from 'mongoose';

interface JwtPayload {
  sub: string;
  email?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    const authConfig = configService.get('auth');
    if (!authConfig?.jwtSecret) throw new Error('JWT_SECRET is not defined');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user: UserDocument | null = await this.usersService.findById(
      payload.sub,
    );
    if (!user) throw new UnauthorizedException('User not found');

    return {
      userId: (user._id as Types.ObjectId).toString(),
      email: user.email,
      role: user.role,
    };
  }
}
