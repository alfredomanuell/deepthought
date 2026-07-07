import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileUploadService } from './file-upload.service';
import { CreateResourceDto, UploadResourceDto, ResourcesQueryDto } from './dto/resources.dto';
import { Role, ResourceType } from '@prisma/client';

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async findAll(query: ResourcesQueryDto) {
    const { projectId, type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (type) {
      where.type = type;
    }

    const [resources, total] = await this.prisma.$transaction([
      this.prisma.resource.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, login: true, displayName: true, avatar: true },
          },
          project: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.resource.count({ where }),
    ]);

    return {
      data: resources,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByProject(projectId: string, page = 1, limit = 20) {
    return this.findAll({ projectId, page, limit });
  }

  async create(userId: string, dto: CreateResourceDto) {
    this.logger.log(`User ${userId} creating resource: ${dto.title}`);

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    return this.prisma.resource.create({
      data: {
        title: dto.title,
        description: dto.description,
        url: dto.url,
        type: dto.type,
        userId,
        projectId: dto.projectId,
      },
      include: {
        user: { select: { id: true, login: true, displayName: true } },
        project: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async createFromFile(userId: string, dto: UploadResourceDto, file: Express.Multer.File) {
    this.logger.log(`User ${userId} uploading file: ${file.originalname}`);

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    const { fileName, fileSize } = this.fileUploadService.saveFile(file);

    return this.prisma.resource.create({
      data: {
        title: dto.title,
        description: dto.description,
        url: fileName,
        originalName: file.originalname,
        fileSize,
        type: ResourceType.FILE,
        userId,
        projectId: dto.projectId,
      },
      include: {
        user: { select: { id: true, login: true, displayName: true } },
        project: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async remove(id: string, userId: string, userRole: Role) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      select: { id: true, userId: true, title: true, type: true, url: true },
    });

    if (!resource) {
      throw new NotFoundException(`Resource ${id} not found`);
    }

    const isOwner = resource.userId === userId;
    const isAdmin = userRole === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You can only delete your own resources');
    }

    await this.prisma.resource.delete({ where: { id } });

    if (resource.type === ResourceType.FILE && resource.url) {
      this.fileUploadService.deleteFile(resource.url);
    }

    this.logger.log(`Resource ${id} deleted by user ${userId}`);

    return { message: `Resource "${resource.title}" deleted successfully` };
  }
}
