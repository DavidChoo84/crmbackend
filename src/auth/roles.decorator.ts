import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

// Defining a constant key prevents magic string typos across your guard and decorator
export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);