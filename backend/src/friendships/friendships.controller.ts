import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { FriendshipsService } from './friendships.service';

/**
 * Controlador do sistema de amizades e bloqueios.
 *
 * Endpoints:
 * GET    /friendships              → Lista de amigos (aceites)
 * GET    /friendships/pending      → Pedidos recebidos e enviados
 * GET    /friendships/blocked      → Utilizadores bloqueados por mim
 * POST   /friendships/:userId      → Enviar pedido de amizade
 * PATCH  /friendships/:id/accept   → Aceitar pedido recebido
 * DELETE /friendships/:id          → Recusar pedido / remover amizade
 * POST   /users/:id/block          → Bloquear utilizador
 * DELETE /users/:id/block          → Desbloquear utilizador
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class FriendshipsController {
  constructor(
    /** Serviço com a lógica de amizades/bloqueios */
    private readonly friendshipsService: FriendshipsService,
  ) {}

  /** GET /friendships — amigos do utilizador autenticado. */
  @Get('friendships')
  listFriends(@CurrentUser('sub') userId: string) {
    return this.friendshipsService.listFriends(userId);
  }

  /**
   * GET /friendships/pending — pedidos pendentes (incoming/outgoing).
   * NOTA: rotas estáticas antes de rotas com :id para não colidirem.
   */
  @Get('friendships/pending')
  listPending(@CurrentUser('sub') userId: string) {
    return this.friendshipsService.listPending(userId);
  }

  /** GET /friendships/blocked — bloqueios feitos pelo utilizador autenticado. */
  @Get('friendships/blocked')
  listBlocked(@CurrentUser('sub') userId: string) {
    return this.friendshipsService.listBlocked(userId);
  }

  /** POST /friendships/:userId — envia pedido de amizade para outro utilizador. */
  @Post('friendships/:userId')
  @HttpCode(HttpStatus.CREATED)
  sendRequest(
    @Param('userId') addresseeId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.friendshipsService.sendRequest(
      { sub: user.sub, login: user.login },
      addresseeId,
    );
  }

  /** PATCH /friendships/:id/accept — aceita um pedido recebido. */
  @Patch('friendships/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.friendshipsService.accept(id, {
      sub: user.sub,
      login: user.login,
    });
  }

  /** DELETE /friendships/:id — recusa pedido pendente ou remove amizade. */
  @Delete('friendships/:id')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.friendshipsService.remove(id, userId);
  }

  /** POST /users/:id/block — bloqueia um utilizador. */
  @Post('users/:id/block')
  @HttpCode(HttpStatus.OK)
  block(@Param('id') targetId: string, @CurrentUser('sub') userId: string) {
    return this.friendshipsService.block(userId, targetId);
  }

  /** DELETE /users/:id/block — desbloqueia um utilizador. */
  @Delete('users/:id/block')
  unblock(@Param('id') targetId: string, @CurrentUser('sub') userId: string) {
    return this.friendshipsService.unblock(userId, targetId);
  }
}
