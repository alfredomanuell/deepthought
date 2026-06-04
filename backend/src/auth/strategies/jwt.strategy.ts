import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Interface que representa o payload do token JWT gerado pelo AuthService.
 */
export interface JwtPayload {
  /** ID interno do utilizador (cuid) */
  sub: string;
  /** Role do utilizador no momento em que o JWT foi gerado */
  role: string;
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
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Método chamado automaticamente pelo Passport após validação da assinatura JWT.
   * Busca o utilizador na base de dados para garantir dados atualizados.
   * O objeto retornado é adicionado ao req.user pelo JwtAuthGuard.
   * @param payload Payload decodificado do JWT
   */
  async validate(payload: JwtPayload) {
    // Busca o utilizador para garantir que ainda existe e não foi banido
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

    // Retorna o user com o accessToken para ser usado nos controllers/services
    // (necessário para chamadas à API 42 após autenticação)
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