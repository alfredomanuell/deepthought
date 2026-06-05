import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(
  Strategy,
  '42',
) {
  constructor(config: ConfigService) {
    super({
      authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
      tokenURL: 'https://api.intra.42.fr/oauth/token',

      clientID: config.get('FORTY_TWO_CLIENT_ID'),
      clientSecret: config.get('FORTY_TWO_CLIENT_SECRET'),

      callbackURL: config.get('FORTY_TWO_CALLBACK_URL'),

      scope: [],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ) {
    done(null, {
      accessToken,
    });
  }
}
