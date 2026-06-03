import { Injectable } from '@nestjs/common';

@Injectable()
export class FortyTwoService {
  async getMe(accessToken: string) {
    const response = await fetch(
      'https://api.intra.42.fr/v2/me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.json();
  }
}