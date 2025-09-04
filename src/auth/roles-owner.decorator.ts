import { SetMetadata } from '@nestjs/common';

export const ROLES_OWNER_KEY = 'roles_owner';
export const RolesOwner = (roles: string[]) =>
  SetMetadata(ROLES_OWNER_KEY, roles);
