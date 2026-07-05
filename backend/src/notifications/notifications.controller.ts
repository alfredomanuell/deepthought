import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { NotificationsQueryDto } from './dto/notifications-query.dto';

/**
 * Controlador de notificações do utilizador autenticado.
 *
 * Endpoints:
 * GET   /notifications           → Lista paginada (?unread=true para só não lidas)
 * PATCH /notifications/read-all  → Marca todas como lidas
 * PATCH /notifications/:id/read  → Marca uma como lida
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    /** Serviço partilhado de notificações (também usado por outros módulos) */
    private readonly notificationsService: NotificationsService,
  ) {}

  /** GET /notifications — lista as notificações do utilizador autenticado. */
  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query(new ValidationPipe({ transform: true }))
    query: NotificationsQueryDto,
  ) {
    return this.notificationsService.findAll(
      userId,
      query.unread ?? false,
      query.page,
      query.limit,
    );
  }

  /**
   * PATCH /notifications/read-all — marca todas como lidas.
   * NOTA: rota estática antes de :id/read para não colidir.
   */
  @Patch('read-all')
  markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  /** PATCH /notifications/:id/read — marca uma notificação própria como lida. */
  @Patch(':id/read')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationsService.markAsRead(userId, id);
  }
}
