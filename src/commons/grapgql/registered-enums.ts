import {
  NotificationTypeEnum,
  OrganisationMembershipStatusEnum,
  OrganisationStatusEnum,
  RoleEnum,
} from '@/database/database.enums';
import { registerEnumType } from '@nestjs/graphql';
import { ActionEnum } from '../enums';

let isRegistered = false;

export function registerGraphqlEnums(): void {
  if (isRegistered) {
    return;
  }

  registerEnumType(OrganisationMembershipStatusEnum, {
    name: 'OrganisationMembershipStatusEnum',
    description: 'Lifecycle status of an organisation membership.',
  });

  registerEnumType(OrganisationStatusEnum, {
    name: 'OrganisationStatusEnum',
    description: 'Status of an organisation.',
  });

  registerEnumType(RoleEnum, {
    name: 'RoleEnum',
    description: 'Role assigned to an organisation membership.',
  });

  registerEnumType(ActionEnum, {
    name: 'SuspensionHistoryActionEnum',
    description: 'Action recorded in membership suspension history.',
  });

  registerEnumType(NotificationTypeEnum, {
    name: 'NotificationTypeEnum',
    description: 'Type of Notification.',
  });

  isRegistered = true;
}

registerGraphqlEnums();
