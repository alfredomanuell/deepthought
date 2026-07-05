import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { FeedbackService } from './feedback.service';

class SubmitFeedbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async submit(@Body() dto: SubmitFeedbackDto): Promise<void> {
    await this.feedbackService.submit(dto.name, dto.email, dto.title, dto.message);
  }
}
