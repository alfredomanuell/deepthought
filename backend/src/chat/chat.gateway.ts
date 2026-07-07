import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatRoomType } from '@prisma/client';
import { buildCorsOrigins } from '../common/cors-origins.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ChatService } from './chat.service';
import { ChatRoomDto, ChatSendDto } from './dto/chat.dto';

function chatRoom(roomId: string): string {
  return `chat:${roomId}`;
}

/**
 * Partilha o servidor socket.io (namespace default) com o WorldGateway —
 * a autenticação do handshake é feita lá, que preenche client.data.userId.
 * Handlers aqui só aceitam sockets já autenticados.
 */
@WebSocketGateway({
  cors: { origin: buildCorsOrigins(), credentials: true },
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  private userIdOf(client: Socket): string | null {
    return (client.data as { userId?: string })?.userId ?? null;
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatRoomDto,
  ): Promise<void> {
    const userId = this.userIdOf(client);
    if (!userId) return;

    try {
      await this.chat.assertMember(body.roomId, userId);
      await client.join(chatRoom(body.roomId));
    } catch {
      /** Acesso negado/sala inexistente: ignora sem rebentar o socket. */
    }
  }

  @SubscribeMessage('chat:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatRoomDto,
  ): Promise<void> {
    await client.leave(chatRoom(body.roomId));
  }

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatSendDto,
  ): Promise<void> {
    const userId = this.userIdOf(client);
    if (!userId) return;

    let saved: Awaited<ReturnType<ChatService['saveMessage']>>;
    try {
      saved = await this.chat.saveMessage(body.roomId, userId, body.content);
    } catch {
      client.emit('chat:error', { roomId: body.roomId, message: 'Message rejected' });
      return;
    }

    const { message, roomType, recipientId } = saved;

    this.server.to(chatRoom(body.roomId)).emit('chat:message', message);

    if (roomType === ChatRoomType.PRIVATE && recipientId) {
      /** Sessões do destinatário que não têm a DM aberta (badge nas rooms). */
      this.realtime.emitToUser(recipientId, 'chat:message', message);

      /** Offline: notificação persistida para ver ao voltar. */
      if (!this.realtime.isUserConnected(recipientId)) {
        await this.notifications.notifyNewMessage(
          recipientId,
          message.sender.login,
        );
      }
    }
  }

  /** Volátil, sem persistência — reenvia aos outros da sala. */
  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatRoomDto,
  ): void {
    const userId = this.userIdOf(client);
    if (!userId) return;

    client.to(chatRoom(body.roomId)).emit('chat:typing', {
      roomId: body.roomId,
      userId,
    });
  }

  @SubscribeMessage('chat:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatRoomDto,
  ): Promise<void> {
    const userId = this.userIdOf(client);
    if (!userId) return;

    try {
      const receipt = await this.chat.markRead(body.roomId, userId);
      client.to(chatRoom(body.roomId)).emit('chat:read', receipt);
    } catch {
      /** Sala inexistente/sem acesso: ignora. */
    }
  }
}
