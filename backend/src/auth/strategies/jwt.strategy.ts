import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtUser } from '../interfaces/jwt-user.interface';
import { getJwtSecret } from '../jwt-secret.util';

/**
 * Interface que representa o payload do token JWT gerado pelo AuthService.
 */
export interface JwtPayload {
  /** ID interno do utilizador (cuid) */
  sub: string;
  /** Role do utilizador no momento em que o JWT foi gerado */
  role?: Role;
  /** Token OAuth2 da sessão 42 (necessário para chamadas à API 42) */
  accessToken?: string;
}

/**
 * Estratégia JWT do Passport.
 * Valida o token Bearer extraído do header Authorization.
 * Após validação do token, busca o utilizador na base de dados
 * para garantir que ainda existe e não está banido.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    /** Acesso às variáveis de ambiente para o secret do JWT */
    config: ConfigService,
    /** Acesso à base de dados para verificar o utilizador */
    private readonly prisma: PrismaService,
  ) {
    super({
      // Extrai o JWT do header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Rejeita tokens expirados automaticamente
      ignoreExpiration: false,
      // Secret usado para assinar e verificar o token
      secretOrKey: getJwtSecret(config),
    });
  }

  /**
   * Método chamado automaticamente pelo Passport após validação da assinatura JWT.
   * Busca o utilizador na base de dados para garantir dados atualizados.
   * O objeto retornado é adicionado ao req.user pelo JwtAuthGuard.
   * @param payload Payload decodificado do JWT
   */
  async validate(payload: JwtPayload): Promise<JwtUser> {
    /**
     * O JWT só é útil se tiver subject.
     * Mesmo que a assinatura seja válida, um token sem `sub` não identifica
     * nenhum utilizador da aplicação.
     */
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    /**
     * Busca o utilizador na base de dados para obter role e ban actualizados.
     * Não confiamos no role guardado no JWT, porque o admin pode alterar roles
     * ou banir utilizadores depois de o token ter sido emitido.
     */
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        isBanned: true,
        login: true,
        displayName: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    /**
     * Banimento é uma falha de autenticação no fluxo pedido.
     * Isto impede que controllers e guards seguintes sejam executados.
     */
    if (user.isBanned) {
      throw new UnauthorizedException('User account is banned');
    }

    /**
     * Retorna o objecto normalizado que será atribuído a `request.user`.
     * O access token da 42 é preservado apenas quando vinha no JWT interno.
     */
    return {
      sub: user.id,
      role: user.role,
      isBanned: user.isBanned,
      login: user.login,
      displayName: user.displayName,
      // O accessToken é passado no payload para que o SyncService possa
      // fazer chamadas à API 42 em nome do utilizador
      accessToken: payload.accessToken,
    };
  }
}
