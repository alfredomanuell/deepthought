import {
  Controller,
  Get,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';

import type { Response } from 'express';

@Controller('auth')
export class AuthController {

  constructor(
    private readonly authService: AuthService,
  ) {}

  @Get('42/login')
  @UseGuards(AuthGuard('42'))
  async login() {}

  @Get('42/callback')
  @UseGuards(AuthGuard('42'))
  async callback(@Req() req, @Res() res: Response) {
    const tokens = await this.authService.login42(
      req.user.accessToken,
    );

  res.cookie('access_token', tokens.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  });

  return res.redirect(`${process.env.FRONTEND_URL}/game`,);
  }
}
