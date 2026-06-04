import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SyncService } from '../sync/sync.service';
import { FortyTwoService } from '../integrations/fortytwo/fortytwo.service';

/**
 * Serviço de autenticação — responsável pelo fluxo OAuth2 com a 42.
 *
 * Fluxo de login:
 * 1. Recebe o accessToken OAuth2 da callback da 42
 * 2. Busca o perfil do utilizador na API 42
 * 3. Cria o utilizador se for o primeiro login
 * 4. Gera o JWT interno
 * 5. Inicia sync assíncrono para actualizar dados
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    /** Acesso à base de dados */
    private readonly prisma: PrismaService,
    /** Geração e validação de JWTs */
    private readonly jwtService: JwtService,
    /** Gestão de utilizadores */
    private readonly usersService: UsersService,
    /** Serviço de sincronização com a API 42 */
    private readonly syncService: SyncService,
    /** Wrapper da API 42 */
    private readonly fortyTwoService: FortyTwoService,
  ) {}

  /**
   * Processa o login via OAuth2 da 42.
   * Cria o utilizador se for novo, ou actualiza lastSeenAt se já existir.
   * Desencadeia sync assíncrono após login.
   * @param accessToken Token OAuth2 obtido da callback da 42
   * @returns JWT de acesso e dados do utilizador
   */
  async login42(accessToken: string): Promise<{ access_token: string; user: any }> {
    this.logger.log('Processing 42 OAuth login');

    // Busca o perfil completo na API 42
    const profile = await this.fortyTwoService.getMe(accessToken);

    // Verifica se o utilizador já existe (pelo ID único da 42)
    let user = await this.usersService.findBy42Id(profile.fortyTwoId);

    if (!user) {
      // Primeiro login: cria o utilizador com os dados básicos do perfil
      this.logger.log(`Creating new user for login: ${profile.login}`);
      user = await this.usersService.createFrom42Profile(profile);
    } else {
      // Login subsequente: actualiza o timestamp da última visita
      this.logger.log(`Existing user logged in: ${profile.login}`);
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      });
    }

    // Gera o JWT com sub (ID do utilizador), role e o accessToken OAuth2
    // O accessToken é guardado no JWT para permitir chamadas à API 42
    const jwt = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      // Inclui o accessToken OAuth2 para o SyncService poder usar
      accessToken,
    });

    // Inicia o sync de forma assíncrona (não bloqueia o login)
    // Usa setImmediate para não atrasar a resposta ao cliente
    setImmediate(async () => {
      try {
        await this.syncService.syncUser(user!.id, accessToken);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `Background sync failed for user ${user!.id}: ${message}`,
        );
      }
    });

    return {
      access_token: jwt,
      user: {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        avatar: user.avatar,
        campus: user.campus,
        level: user.level,
        role: user.role,
      },
    };
  }
}