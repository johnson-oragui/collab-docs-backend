import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  NotificationTypeEnum,
  type TNotificationTypeEnum,
} from '@/database/database.enums';
import {
  CreatableNotificationStatusEnum,
  type TCreatableNotificationStatusEnum,
} from '@/commons/enums';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'Scheduled maintenance window',
    maxLength: 255,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  declare title: string;

  @ApiProperty({
    description: 'Notification body message',
    example: 'System maintenance will occur tonight from 02:00 to 03:00 UTC.',
    maxLength: 5000,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  declare message: string;

  @ApiPropertyOptional({
    description: 'Notification category/type',
    enum: NotificationTypeEnum,
    default: NotificationTypeEnum.ANNOUNCEMENT,
  })
  @IsOptional()
  @IsEnum(NotificationTypeEnum)
  type?: TNotificationTypeEnum = NotificationTypeEnum.ANNOUNCEMENT;

  @ApiProperty({
    description: 'Initial lifecycle status (DRAFT or PUBLISHED only)',
    enum: CreatableNotificationStatusEnum,
    example: CreatableNotificationStatusEnum.DRAFT,
    required: true,
  })
  @IsEnum(CreatableNotificationStatusEnum, {
    message: 'Status must be either DRAFT or PUBLISHED.',
  })
  declare status: TCreatableNotificationStatusEnum;

  @ApiProperty({
    description: 'Target organisation membership IDs',
    type: [String],
    example: ['01950f4b-8c12-7a4e-9d21-3f5b8a1c6e20'],
  })
  @ValidateIf(
    (dto: CreateNotificationDto) =>
      dto.status === CreatableNotificationStatusEnum.PUBLISHED,
  )
  @ArrayNotEmpty({
    message:
      'At least one recipient membership ID is required when publishing.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, {
    each: true,
    message: 'Each recipient membership ID must be a valid UUID.',
  })
  recipientMembershipIds?: string[];
}
