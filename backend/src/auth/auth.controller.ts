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
    private readonly authService: AuthService,
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
    const result = await this.authService.login42(req.user.accessToken);

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    if ('requiresOtp' in result) {
      return res.redirect(
        `${frontendUrl}/OTPemail?userId=${encodeURIComponent(result.userId)}`,
      );
    }

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    });

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

    /**
     * Utilizadores que completaram OTP mas não terminaram a criação de personagem
     * são enviados para /CharacterCreation em vez do jogo.
     */
    if (!result.user.characterCreated) {
      return res.redirect(`${frontendUrl}/CharacterCreation?${params.toString()}`);
    }

    return res.redirect(`${frontendUrl}/Game?${params.toString()}`);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<OtpTokens> {
    return this.otpService.refreshTokens(dto.refreshToken);
  }
}
