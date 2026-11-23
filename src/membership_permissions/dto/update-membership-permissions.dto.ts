import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { InvitePermissionsDto } from '@/permissions/dto/invitation-permissions.dto';

export class UpdateMembershipPermissionsDto {
  @ApiProperty({
    description:
      'Nested permission map specifying actions to grant (true) or revoke (false).',
    example: {
      document: {
        create: true,
        read: true,
        update: false,
        delete: false,
      },
      documentComment: {
        create: true,
        read: true,
      },
    },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => InvitePermissionsDto)
  declare permissions: InvitePermissionsDto;
}
