import { ApiProperty } from '@nestjs/swagger';

import type { Attachment } from '@prisma/client';

export class TicketAttachmentDto {
  @ApiProperty({
    example: '2b7c4de8-1c66-4a89-a472-8c5a57a5f9dd',
  })
  id!: string;

  @ApiProperty({
    example: '7b2415c1-672e-4b72-8302-47c4c0b87566',
  })
  ticketId!: string;

  @ApiProperty({
    example: null,
    nullable: true,
  })
  messageId!: string | null;

  @ApiProperty({
    example: '2d5089f9-d728-4d4e-b7f0-57ef4bf54c5e',
  })
  uploadedById!: string;

  @ApiProperty({
    example: 'error-log.txt',
  })
  filename!: string;

  @ApiProperty({
    example: 'text/plain',
  })
  mimeType!: string;

  @ApiProperty({
    example: 2048,
  })
  sizeBytes!: number;

  @ApiProperty({
    example: '2026-04-24T14:30:00.000Z',
  })
  createdAt!: string;

  static fromRecord(attachment: Attachment): TicketAttachmentDto {
    return {
      id: attachment.id,
      ticketId: attachment.ticketId,
      messageId: attachment.messageId,
      uploadedById: attachment.uploadedById,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt.toISOString(),
    };
  }
}

export class AttachmentDownloadUrlDto {
  @ApiProperty({
    example:
      'http://localhost:9000/customer-support/tickets/7b2415c1/attachments/file.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256',
  })
  url!: string;

  @ApiProperty({
    example: 300,
  })
  expiresInSeconds!: number;
}

export class AttachmentUploadBodyDto {
  @ApiProperty({
    format: 'binary',
    type: 'string',
  })
  file!: unknown;
}
