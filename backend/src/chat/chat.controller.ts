import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

/**
 * API REST do chat — arranque e histórico; o tempo real vive no ChatGateway.
 *
 * Endpoints:
 * GET  /chat/rooms                → Salas do utilizador (global + DMs, unread)
 * GET  /chat/rooms/:id/messages   → Histórico paginado (?before=<ISO>)
 * POST /chat/dm/:userId           → Abre (ou devolve) a DM com outro utilizador
 */
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    /** Persistência e regras de acesso do chat */
    private readonly chatService: ChatService,
  ) {}

  /** GET /chat/rooms — lista global + DMs com contagem de não lidas. */
  @Get('rooms')
  listRooms(@CurrentUser('sub') userId: string) {
    return this.chatService.listRooms(userId);
  }

  /** GET /chat/rooms/:id/messages — histórico (50 por página, cursor `before`). */
  @Get('rooms/:id/messages')
  getHistory(
    @Param('id') roomId: string,
    @CurrentUser('sub') userId: string,
    @Query('before') before?: string,
  ) {
    return this.chatService.getHistory(roomId, userId, before);
  }

  /** POST /chat/dm/:userId — abre ou devolve a DM com o utilizador indicado. */
  @Post('dm/:userId')
  @HttpCode(HttpStatus.OK)
  openDm(
    @Param('userId') otherId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.chatService.getOrCreateDm(userId, otherId);
  }
}
