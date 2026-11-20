import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { GqlExecutionContext, GqlContextType } from '@nestjs/graphql';
import { type Request as ExRequest } from 'express';

import {
  IPermissionRequirement,
  REQUIRED_PERMISSIONS_KEY,
} from '@/commons/decorators/require-permissions.decorator';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { TPermissionEnum } from '@/permissions/permission.registry';
import { OrganisationMembershipStatusEnum } from '@/database/database.enums';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,

    @InjectRepository(OrganisationMembershipEntity)
    private readonly membershipRepository: Repository<OrganisationMembershipEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement =
      this.reflector.getAllAndOverride<IPermissionRequirement>(
        REQUIRED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

    // allow entry if no permission requirement was declared for this route.
    if (!requirement || requirement.permissions.length === 0) {
      return true;
    }

    const request = this.getRequest(context);

    const userId = request.user?.id ?? request.decodedUser?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    const organisationId = this.getOrganisationId(request);

    if (!organisationId) {
      throw new ForbiddenException(
        'An organisation context is required to access this resource',
      );
    }

    const membership: OrganisationMembershipEntity | null =
      request.membership ??
      (await this.membershipRepository.findOne({
        where: {
          user: { id: userId, isDeleted: false },
          organisation: { id: organisationId, isDeleted: false },
          status: OrganisationMembershipStatusEnum.ACTIVE,
          isDeleted: false,
        },
        relations: {
          permissions: { permission: true },
          role: true,
        },
      }));

    if (!membership) {
      throw new ForbiddenException(
        'You do not have an active membership in this organisation',
      );
    }

    if (!membership.role) {
      throw new ForbiddenException(
        'No role is assigned to your organisation membership',
      );
    }
    request.membership = membership;

    const assignedPermissions = new Set<TPermissionEnum>(
      membership.permissions.map(
        (permission) => permission.permission.name as TPermissionEnum,
      ),
    );

    const hasPermission = (permission: TPermissionEnum) =>
      assignedPermissions.has(permission);

    const isAuthorized =
      requirement.mode === 'ANY'
        ? requirement.permissions.some(hasPermission)
        : requirement.permissions.every(hasPermission);

    if (!isAuthorized) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }

  private getRequest(context: ExecutionContext): ExRequest {
    if (context.getType<GqlContextType>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext<{
        req: ExRequest;
      }>().req;
    }

    return context.switchToHttp().getRequest<ExRequest>();
  }

  private getOrganisationId(request: Request): string | null {
    if (request.authType === 'ACCESS_TOKEN') {
      return request.decodedUser?.organisationId ?? null;
    }

    if (request.authType === 'API_KEY') {
      return request.organisation?.id ?? null;
    }

    return null;
  }
}
