import {
  IsString,
  IsOptional,
  MaxLength,
  IsUrl,
} from 'class-validator';

/**
 * DTO para actualizar o perfil do utilizador autenticado.
 * Todos os campos são opcionais — apenas os enviados são actualizados.
 *
 * Endpoint: PATCH /users/me
 */
export class UpdateProfileDto {
  /**
   * Nome de exibição personalizado.
   * Máximo de 50 caracteres.
   * @example "João Silva"
   */
  @IsOptional()
  @IsString({ message: 'displayName must be a string' })
  @MaxLength(50, { message: 'displayName must be at most 50 characters' })
  displayName?: string;

  /**
   * URL do avatar personalizado.
   * Deve ser uma URL válida.
   * @example "https://cdn.example.com/avatars/joao.png"
   */
  @IsOptional()
  @IsUrl({}, { message: 'avatar must be a valid URL' })
  @MaxLength(500, { message: 'avatar URL must be at most 500 characters' })
  avatar?: string;

  /**
   * Biografia/descrição do perfil.
   * Máximo de 300 caracteres.
   * @example "42 Lisboa student, working on ft_transcendence"
   */
  @IsOptional()
  @IsString({ message: 'bio must be a string' })
  @MaxLength(300, { message: 'bio must be at most 300 characters' })
  bio?: string;
}