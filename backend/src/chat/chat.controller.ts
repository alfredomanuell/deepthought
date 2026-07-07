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

/** API REST do chat — arranque e histórico; o tempo real vive no ChatGateway. */
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  listRooms(@CurrentUser('sub') userId: string) {
    return this.chatService.listRooms(userId);
  }

  @Get('rooms/:id/messages')
  getHistory(
    @Param('id') roomId: string,
    @CurrentUser('sub') userId: string,
    @Query('before') before?: string,
  ) {
    return this.chatService.getHistory(roomId, userId, before);
  }

  @Post('dm/:userId')
  @HttpCode(HttpStatus.OK)
  openDm(
    @Param('userId') otherId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.chatService.getOrCreateDm(userId, otherId);
  }
}
