import { IsString, MaxLength, MinLength } from 'class-validator';

/** Payload dos eventos que só referem uma sala (chat:join, chat:read, ...). */
export class ChatRoomDto {
  /** ID da sala de chat alvo do evento. */
  @IsString()
  roomId!: string;
}

/** Payload do evento chat:send. */
export class ChatSendDto {
  /** ID da sala onde a mensagem é enviada. */
  @IsString()
  roomId!: string;

  /** Conteúdo textual da mensagem. */
  @IsString()
  @MinLength(1, { message: 'message cannot be empty' })
  @MaxLength(1000, { message: 'message must be at most 1000 characters' })
  content!: string;
}
