import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseFilters,
  UseGuards,
  Res,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { FortyTwoOAuthExceptionFilter } from './filters/forty-two-oauth-exception.filter';
import { OtpService, OtpTokens } from './otp/otp.service';

import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    /** AuthService concentra o fluxo OAuth 42 -> User/sync -> OTP ou JWT. */
    private readonly authService: AuthService,
    /** OtpService já possui a emissão/rotação de JWTs, incluindo refresh token. */
    private readonly otpService: OtpService,
  ) {}

  @Get('42/login')
  @UseFilters(FortyTwoOAuthExceptionFilter)
  @UseGuards(AuthGuard('42'))
  async login() {}

  @Get('42/callback')
  @UseFilters(FortyTwoOAuthExceptionFilter)
  @UseGuards(AuthGuard('42'))
  async callback(@Req() req, @Res() res: Response) {
    /** O accessToken vem da strategy OAuth2 da 42 depois da callback. */
    const result = await this.authService.login42(req.user.accessToken);

    /** FRONTEND_URL centraliza o destino do browser depois do OAuth da 42. */
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    /** Primeiro login: o backend já gerou/enviou OTP e redireciona para o ecrã de validação. */
    if ('requiresOtp' in result) {
      /** userId é necessário para POST /auth/otp/verify; não há JWT antes do OTP válido. */
      return res.redirect(
        `${frontendUrl}/OTPemail?userId=${encodeURIComponent(result.userId)}`,
      );
    }

    /** Login futuro: guarda cookies para compatibilidade com clientes que já os usem. */
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    });

    /** Refresh token também segue em cookie httpOnly para não depender só de localStorage. */
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    /**
     * O frontend actual protege /Game lendo tokens do localStorage.
     * Como um redirect OAuth não consegue escrever localStorage no backend,
     * enviamos os tokens uma única vez na query; ProtectedRoute guarda e limpa a URL.
     */
    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    /** Depois do OAuth -> sync -> JWT, o browser entra directamente no jogo. */
    return res.redirect(`${frontendUrl}/Game?${params.toString()}`);
  }

  /**
   * POST /auth/refresh
   * Renova access/refresh tokens para o ProtectedRoute do frontend sem refazer OAuth ou OTP.
   */
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<OtpTokens> {
    /** Reutiliza a validação/hash/rotação de tokens existente no OtpService. */
    return this.otpService.refreshTokens(dto.refreshToken);
  }
}
