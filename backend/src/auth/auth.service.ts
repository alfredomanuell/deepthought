import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SyncService } from '../sync/sync.service';
import { FortyTwoService } from '../integrations/fortytwo/fortytwo.service';
import { OtpService, OtpTokens } from './otp/otp.service';

/** Resposta quando o primeiro login precisa validar OTP antes de receber JWT. */
export interface RequiresOtpResponse {
  /** Sinaliza ao frontend que deve abrir o ecrã de OTP. */
  requiresOtp: true;
  /** ID interno usado pelo POST /auth/otp/verify junto com o código. */
  userId: string;
}

/** Resposta normal para utilizadores já verificados. */
export interface AuthTokensResponse extends OtpTokens {
  /** Alias temporário para manter compatibilidade com o cookie antigo. */
  access_token: string;
  /** Dados públicos mínimos para o frontend após autenticação. */
  user: {
    id: string;
    login: string;
    displayName: string;
    avatar: string | null;
    campus: string | null;
    coalition: string | null;
    level: number;
    role: string;
  };
}

/** União dos dois caminhos possíveis depois do OAuth da 42. */
export type Login42Response = RequiresOtpResponse | AuthTokensResponse;

/**
 * Serviço de autenticação — responsável pelo fluxo OAuth2 com a 42.
 *
 * Fluxo de login:
 * 1. Recebe o accessToken OAuth2 da callback da 42
 * 2. Busca o perfil do utilizador na API 42
 * 3. Cria o utilizador se for o primeiro login
 * 4. Se isEmailVerified=false, envia OTP e não gera JWT
 * 5. Se isEmailVerified=true, gera JWT imediatamente
 * 6. Inicia sync assíncrono para actualizar dados
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    /** Acesso à base de dados */
    private readonly prisma: PrismaService,
    /** Gestão de utilizadores */
    private readonly usersService: UsersService,
    /** Serviço de sincronização com a API 42 */
    private readonly syncService: SyncService,
    /** Wrapper da API 42 */
    private readonly fortyTwoService: FortyTwoService,
    /** Serviço que gere OAuth -> OTP -> JWT no primeiro login */
    private readonly otpService: OtpService,
  ) {}

  /**
   * Processa o login via OAuth2 da 42.
   * Cria o utilizador se for novo, ou actualiza lastSeenAt se já existir.
   * Desencadeia sync assíncrono após login.
   * @param accessToken Token OAuth2 obtido da callback da 42
   * @returns Pedido de OTP no primeiro login ou JWTs nos logins seguintes
   */
  async login42(accessToken: string): Promise<Login42Response> {
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

    // Executa o sync do login com o perfil já carregado, sem nova chamada à API 42.
    // O JWT só é emitido depois de User/Projects ficarem consistentes no Prisma.
    await this.syncService.syncFromProfile(user.id, profile);

    // Recarrega o User depois do sync para devolver JWT/profile com coalition, campus e nível atuais.
    user = await this.prisma.user.findUniqueOrThrow({
      /** O ID interno foi definido antes do sync e continua a ser a fonte canónica. */
      where: { id: user.id },
    });

    // Primeiro login: email ainda não foi verificado por OTP nesta aplicação.
    // Nesta situação não emitimos JWT, para impedir sessão antes da validação.
    if (user.isEmailVerified === false) {
      await this.otpService.generateAndSendOtp(user);

      return {
        requiresOtp: true,
        userId: user.id,
      };
    }

    // Logins futuros: o OTP já foi validado no passado, por isso segue normal.
    // O accessToken OAuth2 é incluído no JWT para permitir sync manual com a 42.
    const tokens = await this.otpService.issueTokens(user, accessToken);

    return {
      success: tokens.success,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      access_token: tokens.accessToken,
      user: {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        avatar: user.avatar,
        campus: user.campus,
        coalition: user.coalition,
        level: user.level,
        role: user.role,
      },
    };
  }
}
