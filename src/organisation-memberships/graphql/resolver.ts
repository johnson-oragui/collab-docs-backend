import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { type Request as ExRequest } from 'express';

import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { GQLOrganisationMembershipModel } from '@/organisation-memberships/graphql/organisation-memberships.model';
import { OrganisationMembershipService } from '@/organisation-memberships/organisation-memberships.service';
import { PermissionGuard } from '@/commons/guards/permission.guard';
import { RequirePermissions } from '@/commons/decorators/require-permissions.decorator';
import { PermissionEnum } from '@/permissions/permission.registry';
import {
  GetOrganisationMembershipsInput,
  OrganisationMembershipsResponseDto,
  OrganisationMembershipsResponseType,
} from '@/organisation-memberships/graphql/dto/get-organisation-memberships.input';

@Resolver(() => GQLOrganisationMembershipModel)
export class OrganisationMembershipResolver {
  constructor(
    private readonly organisationMembershipService: OrganisationMembershipService,
  ) {}

  @Query(() => OrganisationMembershipsResponseDto, {
    name: 'getOrganisationMemberships',
    description: 'Retrieves Organisation Membership(s).',
  })
  @RequirePermissions(PermissionEnum.ORGANISATION_MEMBERSHIP.READ)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  async getOrganisationMemberships(
    @Context('req') req: ExRequest,
    @Args('filter', {
      type: () => GetOrganisationMembershipsInput,
      nullable: true,
    })
    filter?: GetOrganisationMembershipsInput,
  ): Promise<OrganisationMembershipsResponseType> {
    return await this.organisationMembershipService.getMemberships(req, filter);
  }
}
