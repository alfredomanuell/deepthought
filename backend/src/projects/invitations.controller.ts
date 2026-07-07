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

class InviteUserDto {
  @IsString()
  userId!: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

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

  @Get('invitations')
  list(@CurrentUser('sub') userId: string) {
    return this.invitationsService.list(userId);
  }

  @Patch('invitations/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.invitationsService.accept(id, {
      sub: user.sub,
      login: user.login,
    });
  }

  @Patch('invitations/:id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.invitationsService.reject(id, {
      sub: user.sub,
      login: user.login,
    });
  }
}
