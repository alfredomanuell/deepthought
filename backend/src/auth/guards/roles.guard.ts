import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard que verifica se o utilizador autenticado tem o role necessário
 * para aceder a um endpoint específico.
 *
 * Deve ser usado APÓS o JwtAuthGuard (que garante que req.user existe).
 * Lê os roles definidos pelo decorator @Roles() nos metadados do handler.
 *
 * Se nenhum role for definido no endpoint, permite o acesso.
 *
 * @example
 * // Aplicar globalmente em conjunto com JwtAuthGuard
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.ADMIN)
 * @Get()
 * adminEndpoint() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    /** Reflector permite ler os metadados definidos pelos decorators */
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Lê os roles necessários dos metadados do handler ou da classe
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se não houver roles definidos, permite o acesso (endpoint público ou protegido apenas por JWT)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Extrai o utilizador do request (já validado pelo JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('No authenticated user found');
    }

    // Verifica se o role do utilizador está na lista de roles permitidos
    const hasRole = requiredRoles.includes(user.role as Role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}. Your role: ${user.role}`,
      );
    }

    return true;
  }
}