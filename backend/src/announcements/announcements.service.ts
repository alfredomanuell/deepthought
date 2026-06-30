import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.announcement.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: { id: true, login: true, displayName: true } },
      },
    });
  }

  create(authorId: string, dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        pinned: dto.pinned ?? false,
        authorId,
      },
      include: {
        author: { select: { id: true, login: true, displayName: true } },
      },
    });
  }

  async remove(id: string) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException(`Announcement ${id} not found`);
    await this.prisma.announcement.delete({ where: { id } });
    return { message: 'Announcement deleted' };
  }
}
