import { Module } from '@nestjs/common';
import { FortytwoService } from './fortytwo.service';

@Module({
  providers: [FortytwoService]
})
export class FortytwoModule {}
