import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

@Injectable()
export class FeedbackService {
  constructor(private readonly mailService: MailService) {}

  async submit(name: string, email: string, title: string, message: string): Promise<void> {
    await this.mailService.sendFeedbackEmail(name, email, title, message);
  }
}
