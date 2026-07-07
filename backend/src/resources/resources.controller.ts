import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResourcesService } from './resources.service';
import { FileUploadService, FILE_UPLOAD_CONFIG } from './file-upload.service';
import { CreateResourceDto, UploadResourceDto, ResourcesQueryDto } from './dto/resources.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Get('resources')
  findAll(
    @Query(new ValidationPipe({ transform: true })) query: ResourcesQueryDto,
  ) {
    return this.resourcesService.findAll(query);
  }

  @Post('resources')
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: any, @Body(new ValidationPipe()) dto: CreateResourceDto) {
    return this.resourcesService.create(req.user.sub, dto);
  }

  @Post('resources/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_CONFIG))
  upload(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ValidationPipe({ transform: true })) dto: UploadResourceDto,
  ) {
    return this.resourcesService.createFromFile(req.user.sub, dto, file);
  }

  @Delete('resources/:id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.resourcesService.remove(id, req.user.sub, req.user.role);
  }

  @Get('projects/:id/resources')
  findByProject(
    @Param('id') projectId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.resourcesService.findByProject(projectId, page, limit);
  }
}
