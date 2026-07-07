import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChatRoomDto {
  @IsString()
  roomId!: string;
}

export class ChatSendDto {
  @IsString()
  roomId!: string;

  @IsString()
  @MinLength(1, { message: 'message cannot be empty' })
  @MaxLength(1000, { message: 'message must be at most 1000 characters' })
  content!: string;
}
