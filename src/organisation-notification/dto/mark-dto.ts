import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class MarkNotificationDto {
  @ApiProperty({
    description:
      'True to mark notification(s) as read; false to mark as unread.',
    example: true,
  })
  @Type(() => Boolean)
  @IsBoolean()
  declare read: boolean;

  @ApiPropertyOptional({
    description:
      'Optional additional notification IDs to update together for the same membership.',
    type: [String],
    example: [],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('7', { each: true })
  notificationIds: string[] = [];
}
