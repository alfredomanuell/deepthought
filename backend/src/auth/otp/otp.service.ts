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

const OTP_TTL_MINUTES = 10;

export interface OtpTokens {
  success: true;
  accessToken: string;
  refreshToken: string;
}

interface RefreshTokenPayload {
  sub: string;
  role?: Role;
  type?: string;
}

/**
 * O OAuth da 42 continua a ser a única autenticação inicial; este serviço apenas
 * bloqueia a emissão de JWT até o primeiro código enviado por email ser validado.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async generateAndSendOtp(user: User): Promise<void> {
    const code = randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: code,
        otpExpiresAt,
      },
    });

    await this.mailService.sendOtpEmail(user.email, code);

    this.logger.log(`OTP generated for user ${user.id}`);
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<OtpTokens> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('User is already verified');
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException(
        'OTP was not requested or was already used',
      );
    }

    if (user.otpExpiresAt.getTime() <= Date.now()) {
      await this.clearOtp(user.id);
      throw new UnauthorizedException('OTP expired');
    }

    if (!this.secureCompare(user.otpCode, dto.code)) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const verifiedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    return this.issueTokens(verifiedUser);
  }

  /**
   * Reutiliza o hash persistido em User.refreshTokenHash.
   * O campo `type` impede que um accessToken seja aceite como refreshToken.
   * Apenas o refresh token mais recente é aceite (rotação).
   */
  async refreshTokens(refreshToken: string): Promise<OtpTokens> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.isBanned || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    if (user.refreshTokenHash !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Refresh token was rotated');
    }

    return this.issueTokens(user);
  }

  async issueTokens(
    user: User,
    fortyTwoAccessToken?: string,
  ): Promise<OtpTokens> {
    const accessPayload = {
      sub: user.id,
      role: user.role,
      accessToken: fortyTwoAccessToken,
    };

    const refreshPayload = {
      sub: user.id,
      role: user.role,
      type: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: '7d',
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: '30d',
    });

    // Guarda apenas hash do refresh token — nunca o segredo em claro.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    return { success: true, accessToken, refreshToken };
  }

  private async clearOtp(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    });
  }

  /** Comparação em tempo constante para evitar leaks por timing. */
  private secureCompare(expected: string, received: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
