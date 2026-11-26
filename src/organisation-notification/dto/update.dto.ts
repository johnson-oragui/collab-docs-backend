import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import {
  NotificationTypeEnum,
  type TNotificationTypeEnum,
} from '@/database/database.enums';

function HasAtLeastOneUpdateField(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'hasAtLeastOneUpdateField',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const dto = args.object as UpdateNotificationDto;
          return (
            dto.title !== undefined ||
            dto.message !== undefined ||
            dto.type !== undefined ||
            dto.recipientMembershipIds !== undefined
          );
        },
        defaultMessage() {
          return 'At least one updatable field (title, message, type, or recipientMembershipIds) must be provided';
        },
      },
    });
  };
}

export class UpdateNotificationDto {
  @HasAtLeastOneUpdateField()
  private readonly _nonEmptyGuard?: boolean;

  @ApiPropertyOptional({
    description: 'Updated notification title',
    example: 'Updated maintenance window',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated notification message body',
    example:
      'Maintenance will start 30 minutes later than previously announced.',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Updated notification category/type',
    enum: NotificationTypeEnum,
  })
  @IsOptional()
  @IsEnum(NotificationTypeEnum)
  type?: TNotificationTypeEnum;

  @ApiPropertyOptional({
    description:
      'Replacement list of target active membership IDs in the organisation (duplicates removed)',
    type: [String],
    example: ['01950f4b-8c12-7a4e-9d21-3f5b8a1c6e20'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, {
    each: true,
    message: 'Each recipient membership ID must be a valid UUID.',
  })
  recipientMembershipIds?: string[];
}
