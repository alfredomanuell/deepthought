import {
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador do módulo de sincronização.
 * Expõe o endpoint que permite forçar uma sincronização manual
 * dos dados do utilizador com a API 42.
 */
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(
    /** Serviço que executa a lógica de sincronização */
    private readonly syncService: SyncService,
  ) {}

  /**
   * POST /sync/me
   * Força uma sincronização manual do utilizador autenticado com a API 42.
   * Atualiza: nível, xp, campus, coligação, projetos e eval points.
   *
   * O token OAuth2 da sessão 42 é passado no request (guardado no JWT payload).
   *
   * @example
   * POST /sync/me
   * Authorization: Bearer <jwt_token>
   *
   * Response: 200 OK
   * { "message": "Sync completed successfully" }
   */
  @Post('me')
  @HttpCode(HttpStatus.OK)
  async syncMe(@Req() req: any) {
    // Extrai o ID do utilizador autenticado e o token OAuth2 do payload JWT
    const userId: string = req.user.sub;
    const accessToken: string = req.user.accessToken;

    this.logger.log(`Manual sync requested by user ${userId}`);

    await this.syncService.syncUser(userId, accessToken);

    return { message: 'Sync completed successfully' };
  }
}