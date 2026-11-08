import { Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrganisationEntity } from './organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { OrganisationMembershipStatusEnum } from '@/database/database.enums';
import { OrganisationOwnershipHistoryEntity } from '@/organisation-ownership-history/organisation-ownership-history.entity';

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(OrganisationEntity)
    private readonly orgRepository: Repository<OrganisationEntity>,
    @InjectRepository(OrganisationMembershipEntity)
    private readonly membershipRepository: Repository<OrganisationMembershipEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async transferOwnership(
    organisationId: string,
    currentUserId: string,
    newOwnerUserId: string,
    reason?: string,
  ) {
    // Use a transaction so both updates succeed or fail together
    return await this.dataSource.transaction(async (manager) => {
      // Load organisation with current owner
      const org = await manager.findOne(OrganisationEntity, {
        where: { id: organisationId },
        relations: { owner: true },
      });

      if (!org) {
        throw new HttpException(
          { message: 'Organisation not found', success: false },
          404,
        );
      }

      // Verify caller is the current owner
      if (org.owner.id !== currentUserId) {
        throw new HttpException(
          {
            message:
              'Only the current organisation owner can transfer ownership.',
            success: false,
          },
          403,
        );
      }

      // Prevent transferring to self
      if (org.owner.id === newOwnerUserId) {
        throw new HttpException(
          {
            message: 'The user is already the owner of this organisation.',
            success: false,
          },
          400,
        );
      }

      // Verify new owner is an active member of the organisation
      const newOwnerMembership = await manager.findOne(
        OrganisationMembershipEntity,
        {
          where: {
            organisation: { id: organisationId },
            user: { id: newOwnerUserId },
            status: OrganisationMembershipStatusEnum.ACTIVE,
          },
          relations: { user: true },
        },
      );

      if (!newOwnerMembership) {
        throw new HttpException(
          {
            message:
              'The target user must be an active member of the organisation before becoming owner.',
            success: false,
          },
          400,
        );
      }

      const previousOwner = org.owner;
      const newOwner = newOwnerMembership.user;

      // Update organisation owner
      org.owner = newOwner;
      await manager.save(org);

      // Record the transfer in history
      const historyRecord = manager.create(OrganisationOwnershipHistoryEntity, {
        organisation: org,
        previousOwner,
        newOwner,
        reason: reason || 'Voluntary ownership transfer',
      });
      await manager.save(historyRecord);

      return {
        success: true,
        message: `Organisation ownership successfully transferred to ${newOwner.email}`,
        previousOwnerId: previousOwner.id,
        newOwnerId: newOwner.id,
      };
    });
  }
}
