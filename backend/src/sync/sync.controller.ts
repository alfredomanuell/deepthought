import {
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  @Post('me')
  @HttpCode(HttpStatus.OK)
  async syncMe(@Req() req: any) {
    const userId: string = req.user.sub;
    const accessToken: string = req.user.accessToken;

    /** Tokens emitidos após OTP inicial podem não ter token 42; nesses casos sync manual não é possível. */
    if (!accessToken) {
      throw new UnauthorizedException('42 OAuth token is required to sync');
    }

    this.logger.log(`Manual sync requested by user ${userId}`);

    await this.syncService.syncUser(userId, accessToken);

    return { message: 'Sync completed successfully' };
  }
}
