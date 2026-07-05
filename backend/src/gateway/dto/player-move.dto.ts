import { IsIn, IsInt } from 'class-validator';
import { DIRECTIONS, type Direction } from '../types/direction.type';

/** Payload recebido no evento `player:move`. */
export class PlayerMoveDto {
  @IsInt()
  lx: number;

  @IsInt()
  ly: number;

  @IsIn(DIRECTIONS)
  direction: Direction;
}
