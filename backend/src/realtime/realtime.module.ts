import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

/**
 * Módulo sem dependências que partilha o servidor socket.io.
 * Importado pelo GatewayModule (que regista o Server) e por módulos
 * que precisam de emitir eventos (ex.: NotificationsModule).
 */
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
