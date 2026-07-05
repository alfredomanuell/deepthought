import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { v4 as uuid } from 'uuid';
import { memoryStorage } from 'multer';

export const FILE_UPLOAD_CONFIG = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
};

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/markdown',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/json',
  'application/javascript',
  'text/javascript',
  'text/html',
  'text/css',
  'application/xml',
  'text/xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor() {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
      this.logger.log(`Created uploads directory at ${UPLOAD_DIR}`);
    }
  }

  saveFile(file: Express.Multer.File): { fileName: string; fileSize: number } {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed: PDF, images, text, archives, documents.`,
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large. Maximum size is 10MB.');
    }

    const ext = extname(file.originalname);
    const safeBase = file.originalname
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const fileName = `${uuid()}-${safeBase}${ext}`;
    const filePath = join(UPLOAD_DIR, fileName);

    writeFileSync(filePath, file.buffer);
    this.logger.log(`Saved file: ${fileName} (${file.size} bytes)`);

    return { fileName, fileSize: file.size };
  }

  deleteFile(fileName: string): void {
    const filePath = join(UPLOAD_DIR, fileName);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      this.logger.log(`Deleted file: ${fileName}`);
    }
  }
}
