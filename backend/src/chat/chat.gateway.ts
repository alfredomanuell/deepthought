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

/** Sala socket.io de uma sala de chat persistida. */
function chatRoom(roomId: string): string {
  return `chat:${roomId}`;
}

/**
 * Eventos de chat em tempo real.
 *
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
    /** Persistência de salas/mensagens/leituras */
    private readonly chat: ChatService,
    /** Notificação persistida para destinatários de DM offline */
    private readonly notifications: NotificationsService,
    /** Presença por sala pessoal (user:{id}) para detectar offline */
    private readonly realtime: RealtimeService,
  ) {}

  /** Lê o userId autenticado pelo handshake do WorldGateway. */
  private userIdOf(client: Socket): string | null {
    return (client.data as { userId?: string })?.userId ?? null;
  }

  /** chat:join — entra na sala socket.io depois de validar o acesso. */
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

  /** chat:leave — sai da sala socket.io (a membership na BD mantém-se). */
  @SubscribeMessage('chat:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatRoomDto,
  ): Promise<void> {
    await client.leave(chatRoom(body.roomId));
  }

  /** chat:send — persiste e difunde a mensagem para a sala. */
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

    /** Difunde a quem tem a sala aberta (inclui o próprio remetente). */
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

  /** chat:typing — volátil, sem persistência; reenvia aos outros da sala. */
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

  /** chat:read — actualiza lastReadAt e difunde o read receipt. */
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
