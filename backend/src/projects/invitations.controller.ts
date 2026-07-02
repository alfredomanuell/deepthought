import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { InvitationsService } from './invitations.service';

/** Corpo de POST /projects/:id/invite. */
class InviteUserDto {
  /** ID do utilizador a convidar. */
  @IsString()
  userId!: string;
}

/**
 * Controlador de convites para projectos.
 *
 * Endpoints:
 * POST  /projects/:id/invite     → Convidar utilizador (:id = Project.id)
 * GET   /invitations             → Convites pendentes (incoming/outgoing)
 * PATCH /invitations/:id/accept  → Aceitar (cria UserProject IN_PROGRESS)
 * PATCH /invitations/:id/reject  → Recusar
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(
    /** Serviço com a lógica de convites */
    private readonly invitationsService: InvitationsService,
  ) {}

  /** POST /projects/:id/invite — convida um utilizador para o projecto. */
  @Post('projects/:id/invite')
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Param('id') projectId: string,
    @CurrentUser() user: JwtUser,
    @Body(new ValidationPipe({ whitelist: true })) dto: InviteUserDto,
  ) {
    return this.invitationsService.invite(
      projectId,
      { sub: user.sub, login: user.login },
      dto.userId,
    );
  }

  /** GET /invitations — convites pendentes do utilizador autenticado. */
  @Get('invitations')
  list(@CurrentUser('sub') userId: string) {
    return this.invitationsService.list(userId);
  }

  /** PATCH /invitations/:id/accept — aceita um convite recebido. */
  @Patch('invitations/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.invitationsService.accept(id, {
      sub: user.sub,
      login: user.login,
    });
  }

  /** PATCH /invitations/:id/reject — recusa um convite recebido. */
  @Patch('invitations/:id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.invitationsService.reject(id, {
      sub: user.sub,
      login: user.login,
    });
  }
}
