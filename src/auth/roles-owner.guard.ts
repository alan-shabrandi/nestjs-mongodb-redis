import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_OWNER_KEY } from './roles-owner.decorator';

@Injectable()
export class RolesOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (user.role === 'admin') return true;

    const resourceUserId = request.params.id;
    if (user.role === 'user' && user.userId === resourceUserId) return true;

    throw new ForbiddenException('Access Denied');
  }
}
