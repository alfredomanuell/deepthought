import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtUser } from '../interfaces/jwt-user.interface';
import { getJwtSecret } from '../jwt-secret.util';

export interface JwtPayload {
  sub: string;
  role?: Role;
  /** Token OAuth2 da sessão 42 (necessário para chamadas à API 42) */
  accessToken?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    /**
     * Não confiamos no role guardado no JWT — o admin pode alterar roles
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

    if (user.isBanned) {
      throw new UnauthorizedException('User account is banned');
    }

    return {
      sub: user.id,
      role: user.role,
      isBanned: user.isBanned,
      login: user.login,
      displayName: user.displayName,
      accessToken: payload.accessToken,
    };
  }
}
