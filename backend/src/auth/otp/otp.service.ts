import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifyOtpDto } from './otp.dto';

/** Tempo de vida do OTP em minutos, conforme o fluxo definido. */
const OTP_TTL_MINUTES = 10;

/** Resultado devolvido após o OTP ser validado com sucesso. */
export interface OtpTokens {
  /** Confirma ao frontend que o fluxo OTP -> JWT terminou com sucesso. */
  success: true;
  /** JWT curto usado para autenticar requests protegidos. */
  accessToken: string;
  /** JWT longo usado para renovar sessão no frontend. */
  refreshToken: string;
}

/** Payload mínimo esperado dentro de um refresh token assinado pelo backend. */
interface RefreshTokenPayload {
  /** ID interno do utilizador autenticado. */
  sub: string;
  /** Role guardado no momento da emissão; a BD continua a ser a fonte canónica. */
  role?: Role;
  /** Marcador que impede usar accessToken no endpoint /auth/refresh. */
  type?: string;
}

/**
 * Serviço responsável pelo passo OAuth -> OTP -> JWT.
 *
 * O OAuth da 42 continua a ser a única autenticação inicial; este serviço apenas
 * bloqueia a emissão de JWT até o primeiro código enviado por email ser validado.
 */
@Injectable()
export class OtpService {
  /** Logger dedicado ao fluxo OTP. */
  private readonly logger = new Logger(OtpService.name);

  constructor(
    /** Prisma é usado para guardar, validar e limpar o OTP no model User. */
    private readonly prisma: PrismaService,
    /** JwtService assina accessToken e refreshToken após validação. */
    private readonly jwtService: JwtService,
    /** MailService centraliza o envio do email de verificação. */
    private readonly mailService: MailService,
  ) {}

  /**
   * Gera um OTP de 6 dígitos, guarda no User e envia por email.
   *
   * @param user Utilizador criado/encontrado depois do OAuth da 42.
   */
  async generateAndSendOtp(user: User): Promise<void> {
    /** Geração criptograficamente segura; Math.random não deve ser usado. */
    const code = randomInt(100000, 999999).toString();

    /** Data de expiração definida para 10 minutos depois da geração. */
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    /** Guarda o OTP no próprio User para eliminar a tabela antiga de códigos. */
    await this.prisma.user.update({
      /** O ID interno identifica exactamente a linha do utilizador. */
      where: { id: user.id },
      /** Código e expiração ficam disponíveis para o endpoint de verificação. */
      data: {
        otpCode: code,
        otpExpiresAt,
      },
    });

    /** Envia o email para o endereço vindo da conta OAuth da 42. */
    await this.mailService.sendOtpEmail(user.email, code);

    /** Log operacional sem devolver o OTP na resposta HTTP. */
    this.logger.log(`OTP generated for user ${user.id}`);
  }

  /**
   * Valida o OTP, marca o utilizador como verificado permanentemente e emite JWTs.
   *
   * @param dto Corpo validado recebido pelo controller.
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<OtpTokens> {
    /** Procura o utilizador pelo ID recebido do primeiro passo OAuth. */
    const user = await this.prisma.user.findUnique({
      /** `findUnique` usa a chave primária para evitar ambiguidade. */
      where: { id: dto.userId },
    });

    /** Sem utilizador não há OTP válido a confirmar. */
    if (!user) {
      throw new NotFoundException('User not found');
    }

    /** Se já está verificado, não permitimos reutilizar um OTP antigo. */
    if (user.isEmailVerified) {
      throw new BadRequestException('User is already verified');
    }

    /** A ausência de código indica que o OAuth ainda não gerou OTP ou já foi usado. */
    if (!user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException(
        'OTP was not requested or was already used',
      );
    }

    /** Valida expiração antes de comparar o segredo recebido. */
    if (user.otpExpiresAt.getTime() <= Date.now()) {
      /** Limpa OTP expirado para impedir reutilização posterior. */
      await this.clearOtp(user.id);
      throw new UnauthorizedException('OTP expired');
    }

    /** Comparação em tempo constante evita leaks por timing em códigos parecidos. */
    if (!this.secureCompare(user.otpCode, dto.code)) {
      throw new UnauthorizedException('Invalid OTP');
    }

    /** Marca o email como verificado para nunca mais pedir OTP em logins futuros. */
    const verifiedUser = await this.prisma.user.update({
      /** A actualização é feita no mesmo User que possuía o OTP válido. */
      where: { id: user.id },
      /** Limpa o código depois de usar para impedir replay do mesmo OTP. */
      data: {
        isEmailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    /** Depois da verificação permanente, o fluxo finalmente emite tokens JWT. */
    return this.issueTokens(verifiedUser);
  }

  /**
   * Valida um refresh token existente e emite um novo par access/refresh.
   *
   * Este método suporta o frontend protegido sem recriar JWTService: reutiliza
   * o JwtService injectado, o hash persistido em User.refreshTokenHash e o
   * mesmo issueTokens usado depois do OAuth/OTP.
   */
  async refreshTokens(refreshToken: string): Promise<OtpTokens> {
    let payload: RefreshTokenPayload;

    try {
      /** Verifica assinatura/expiração antes de consultar a base de dados. */
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    /** O campo type impede que um accessToken seja aceite como refreshToken. */
    if (!payload.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    /** Busca o utilizador actual para respeitar banimentos e comparar o hash guardado. */
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.isBanned || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    /** Apenas o refresh token mais recente é aceite, reduzindo replay de tokens antigos. */
    if (user.refreshTokenHash !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Refresh token was rotated');
    }

    /** Reutiliza a emissão centralizada para actualizar hash e devolver novo par JWT. */
    return this.issueTokens(user);
  }

  /**
   * Emite accessToken e refreshToken para o utilizador verificado.
   *
   * @param user Utilizador já persistido como isEmailVerified=true.
   */
  async issueTokens(
    user: User,
    fortyTwoAccessToken?: string,
  ): Promise<OtpTokens> {
    /** Payload mínimo do access token usado pelo JwtStrategy. */
    const accessPayload = {
      sub: user.id,
      role: user.role,
      accessToken: fortyTwoAccessToken,
    };

    /** Payload separado identifica o token longo como refresh token. */
    const refreshPayload = {
      sub: user.id,
      role: user.role,
      type: 'refresh',
    };

    /** Access token curto para chamadas normais ao backend. */
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: '7d',
    });

    /** Refresh token separado para o cliente guardar e renovar sessão. */
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: '30d',
    });

    /** Guarda apenas hash do refresh token para nunca persistir o segredo em claro. */
    await this.prisma.user.update({
      /** O hash fica associado ao utilizador autenticado. */
      where: { id: user.id },
      /** SHA-256 é suficiente aqui porque o token já tem alta entropia. */
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    /** Apenas sucesso e tokens são devolvidos; OTP e expiração nunca saem para o frontend. */
    return { success: true, accessToken, refreshToken };
  }

  /** Remove o OTP do utilizador quando expira ou quando deixa de ser utilizável. */
  private async clearOtp(userId: string): Promise<void> {
    /** Prisma actualiza apenas os campos OTP e preserva o resto do perfil. */
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    });
  }

  /** Compara dois códigos sem curto-circuito baseado no primeiro dígito diferente. */
  private secureCompare(expected: string, received: string): boolean {
    /** Buffers precisam ter o mesmo tamanho para timingSafeEqual não lançar erro. */
    const expectedBuffer = Buffer.from(expected);

    /** O código recebido vem do DTO já validado como 6 dígitos. */
    const receivedBuffer = Buffer.from(received);

    /** Tamanhos diferentes são inválidos e evitam exception de timingSafeEqual. */
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    /** Comparação constante para reduzir informação observável por timing. */
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  /** Hash unidireccional para persistir refreshToken sem guardar o token original. */
  private hashToken(token: string): string {
    /** Digest hexadecimal simples para comparação futura de refresh tokens. */
    return createHash('sha256').update(token).digest('hex');
  }
}
