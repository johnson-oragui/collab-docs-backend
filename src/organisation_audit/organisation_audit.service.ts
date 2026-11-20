import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryOrganisationAuditsDto } from './dto/query-organisation-audits.dto';
import { OrganisationAuditEntity } from './organisation_audit.entity';
import { type Request as ExRequest } from 'express';

@Injectable()
export class OrganisationAuditService {
  constructor(
    @InjectRepository(OrganisationAuditEntity)
    private readonly auditRepository: Repository<OrganisationAuditEntity>,
  ) {}

  async getAuditsForOrganisation(
    request: ExRequest,
    queryDto: QueryOrganisationAuditsDto,
  ) {
    const organisationId =
      request?.decodedUser?.organisationId ?? request?.organisation?.id;
    if (queryDto.organisationId && queryDto.organisationId !== organisationId) {
      throw new HttpException({ message: 'Not enough access' }, 403);
    }
    const {
      page = 1,
      limit = 20,
      eventType,
      actorId,
      startDate,
      endDate,
    } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor')
      .where('audit.organisation_id = :organisationId', { organisationId });

    if (eventType) {
      queryBuilder.andWhere('audit.eventType = :eventType', { eventType });
    }

    if (actorId) {
      queryBuilder.andWhere('actor.id = :actorId', { actorId });
    }

    if (startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    queryBuilder.orderBy('audit.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      message: 'Audit data retrieved successfully',
      success: true,
    };
  }
}
