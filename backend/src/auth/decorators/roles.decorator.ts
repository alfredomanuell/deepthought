import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Chave usada para guardar os roles nos metadados do decorator.
 * O RolesGuard lê este valor para verificar as permissões.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator @Roles() — define quais roles têm acesso a um endpoint.
 *
 * Uso em conjunto com o RolesGuard e o JwtAuthGuard.
 *
 * @example
 * // Apenas administradores podem aceder
 * @Roles(Role.ADMIN)
 * @Get('admin/users')
 * findAll() { ... }
 *
 * @example
 * // Moderadores e admins
 * @Roles(Role.MODERATOR, Role.ADMIN)
 * @Patch('users/:id/ban')
 * banUser() { ... }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);