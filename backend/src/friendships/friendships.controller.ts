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

@Controller()
@UseGuards(JwtAuthGuard)
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Get('friendships')
  listFriends(@CurrentUser('sub') userId: string) {
    return this.friendshipsService.listFriends(userId);
  }

  /** Rotas estáticas antes de rotas com :id para não colidirem. */
  @Get('friendships/pending')
  listPending(@CurrentUser('sub') userId: string) {
    return this.friendshipsService.listPending(userId);
  }

  @Get('friendships/blocked')
  listBlocked(@CurrentUser('sub') userId: string) {
    return this.friendshipsService.listBlocked(userId);
  }

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

  @Patch('friendships/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.friendshipsService.accept(id, {
      sub: user.sub,
      login: user.login,
    });
  }

  @Delete('friendships/:id')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.friendshipsService.remove(id, userId);
  }

  @Post('users/:id/block')
  @HttpCode(HttpStatus.OK)
  block(@Param('id') targetId: string, @CurrentUser('sub') userId: string) {
    return this.friendshipsService.block(userId, targetId);
  }

  @Delete('users/:id/block')
  unblock(@Param('id') targetId: string, @CurrentUser('sub') userId: string) {
    return this.friendshipsService.unblock(userId, targetId);
  }
}
