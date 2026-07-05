import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { getJwtSecret } from '../auth/jwt-secret.util';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { buildCorsOrigins } from '../common/cors-origins.util';
import { RealtimeService, userRoom } from '../realtime/realtime.service';
import { PresenceService } from './presence.service';
import { PlayerMoveDto } from './dto/player-move.dto';
import type { PresenceEntry } from './interfaces/presence-entry.interface';
import type { CharacterLayers } from './types/character-layers.type';

const WORLD_ROOM = 'world';

interface AuthedSocketData {
  userId: string;
}

/**
 * Gateway único do mundo do jogo (mapa único → sala única).
 * Fase 1: apenas presença + sincronização de movimento. Sem validação
 * server-side de "walkability" nem rate limiting (documentado no plano
 * como simplificação conhecida).
 */
@WebSocketGateway({
  cors: { origin: buildCorsOrigins(), credentials: true },
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class WorldGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WorldGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Regista o servidor socket.io no RealtimeService para emissões de outros módulos. */
  afterInit(server: Server): void {
    this.realtime.setServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.emit('client:auth_error', { message: 'Missing token' });
      client.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: getJwtSecret(this.config),
      });
    } catch {
      client.emit('client:auth_error', { message: 'Invalid or expired token' });
      client.disconnect(true);
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        displayName: true,
        isBanned: true,
        characterLayers: true,
      },
    });

    if (!user || user.isBanned) {
      client.emit('client:auth_error', { message: 'User not found or banned' });
      client.disconnect(true);
      return;
    }

    (client.data as AuthedSocketData).userId = user.id;

    const entry: PresenceEntry = {
      userId: user.id,
      displayName: user.displayName,
      characterLayers: user.characterLayers as CharacterLayers | null,
      lx: 0,
      ly: 0,
      direction: 'SE',
    };

    this.presence.add(entry);
    await client.join(WORLD_ROOM);
    /** Sala pessoal usada por notificações em tempo real (RealtimeService). */
    await client.join(userRoom(user.id));

    client.emit('player:state', { players: this.presence.list(user.id) });
    client.to(WORLD_ROOM).emit('player:join', entry);

    this.logger.log(`Player connected: ${user.id}`);
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as AuthedSocketData)?.userId;
    if (!userId) return;

    this.presence.remove(userId);
    client.to(WORLD_ROOM).emit('player:leave', { userId });

    this.logger.log(`Player disconnected: ${userId}`);
  }

  /**
   * O snapshot enviado em handleConnection pode chegar antes de o cliente
   * ter registado listeners (a cena Phaser ainda está a carregar assets),
   * sendo descartado silenciosamente. O cliente pede o roster quando está
   * de facto pronto a renderizá-lo.
   */
  @SubscribeMessage('player:state:request')
  handleStateRequest(@ConnectedSocket() client: Socket): void {
    const userId = (client.data as AuthedSocketData)?.userId;
    if (!userId) return;

    client.emit('player:state', { players: this.presence.list(userId) });
  }

  @SubscribeMessage('player:move')
  handlePlayerMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PlayerMoveDto,
  ): void {
    const userId = (client.data as AuthedSocketData)?.userId;
    if (!userId) return;

    this.presence.updatePosition(userId, body.lx, body.ly, body.direction);

    client.to(WORLD_ROOM).emit('player:move', {
      userId,
      lx: body.lx,
      ly: body.ly,
      direction: body.direction,
    });
  }
}
