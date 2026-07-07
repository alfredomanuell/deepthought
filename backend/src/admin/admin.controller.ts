import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { AdminService } from './admin.service';
import {
  AdminUpdateUserDto,
  AdminUsersQueryDto,
  BanUserDto,
  CreateUserDto,
  UpdateRoleDto,
} from './dto/admin.dto';

/**
 * Todas as rotas exigem JWT válido, utilizador não banido e role ADMIN
 * actual na base de dados.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: AdminUsersQueryDto,
    @CurrentUser() admin: JwtUser,
  ) {
    void admin;
    return this.adminService.findAll(query);
  }

  @Post('users')
  create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateUserDto,
  ) {
    return this.adminService.create(dto);
  }

  @Patch('users/:id')
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AdminUpdateUserDto,
  ) {
    return this.adminService.update(id, dto);
  }

  @Delete('users/:id')
  remove(@Param('id') id: string, @CurrentUser('sub') adminId: string) {
    return this.adminService.remove(id, adminId);
  }

  @Patch('users/:id/ban')
  ban(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: BanUserDto,
  ) {
    return this.adminService.ban(id, adminId, dto);
  }

  @Patch('users/:id/unban')
  unban(@Param('id') id: string) {
    return this.adminService.unban(id);
  }

  @Patch('users/:id/role')
  updateRole(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateRoleDto,
  ) {
    return this.adminService.updateRole(id, adminId, dto);
  }
}
