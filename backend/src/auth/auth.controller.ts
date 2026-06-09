import { Controller, Get, Req, UseGuards, Res } from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';

import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('42/login')
  @UseGuards(AuthGuard('42'))
  async login() {}

  @Get('42/callback')
  @UseGuards(AuthGuard('42'))
  async callback(@Req() req, @Res() res: Response) {
    /** O accessToken vem da strategy OAuth2 da 42 depois da callback. */
    const result = await this.authService.login42(req.user.accessToken);

    /** Primeiro login: responde JSON para o frontend pedir o código OTP. */
    if ('requiresOtp' in result) {
      return res.json(result);
    }

    /** Login futuro: guarda o access token em cookie httpOnly como antes. */
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    });

    /** Depois de autenticado com JWT, redirecciona para a aplicação. */
    return res.redirect(`${process.env.FRONTEND_URL}/game`);
  }
}
