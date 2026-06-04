import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard JWT — protege endpoints que requerem autenticação.
 *
 * Valida o token JWT enviado no header Authorization: Bearer <token>.
 * Após validação, adiciona req.user com os dados do payload JWT
 * (sub, role, accessToken).
 *
 * Também verifica se o utilizador está banido e rejeita o acesso.
 *
 * Uso:
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@Req() req) { return req.user; }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Sobrescreve o método handleRequest para adicionar lógica extra:
   * - Verifica se utilizador está banido
   * - Lança erros descritivos
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Lança erro de autenticação se o token for inválido ou ausente
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing JWT token');
    }

    // Verifica se o utilizador está banido antes de permitir o acesso
    if (user.isBanned) {
      throw new ForbiddenException('Your account has been banned');
    }

    return user;
  }
}