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

/**
 * Serviço de gestão de recursos partilhados.
 * Permite criar, listar e apagar links/PDFs/vídeos associados a projectos.
 */
@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * Lista recursos com filtros e paginação.
   * GET /resources
   * @param query Filtros: projectId, type
   */
  async findAll(query: ResourcesQueryDto) {
    const { projectId, type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Constrói filtro dinamicamente
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
          // Inclui dados do utilizador que partilhou
          user: {
            select: { id: true, login: true, displayName: true, avatar: true },
          },
          // Inclui dados do projecto associado
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

  /**
   * Lista recursos de um projecto específico.
   * GET /projects/:id/resources
   * @param projectId ID do projecto (slug ou ID interno)
   */
  async findByProject(projectId: string, page = 1, limit = 20) {
    return this.findAll({ projectId, page, limit });
  }

  /**
   * Cria um novo recurso partilhado.
   * Verifica se o projecto existe antes de criar.
   * POST /resources
   * @param userId ID do utilizador que partilha
   * @param dto Dados do recurso
   */
  async create(userId: string, dto: CreateResourceDto) {
    this.logger.log(`User ${userId} creating resource: ${dto.title}`);

    // Verifica se o projecto existe
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

  /**
   * Cria um recurso a partir de um ficheiro enviado.
   * POST /resources/upload
   */
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

  /**
   * Apaga um recurso.
   * Apenas o criador ou um ADMIN pode apagar.
   * DELETE /resources/:id
   * @param id ID do recurso
   * @param userId ID do utilizador autenticado
   * @param userRole Role do utilizador autenticado
   */
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