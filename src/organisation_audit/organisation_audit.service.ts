import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryOrganisationAuditsDto } from './dto/query-organisation-audits.dto';
import { OrganisationAuditEntity } from './organisation_audit.entity';
import { type Request as ExRequest } from 'express';
import { Readable } from 'stream';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { PaginationMetaDto } from '@/commons/dtos/pagination-meta.dto';
import { handleServiceMethodError } from '@/commons/util/errorHandler';

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
    try {
      const organisationId =
        request?.decodedUser?.organisationId ?? request?.organisation?.id;
      if (
        queryDto.organisationId &&
        queryDto.organisationId !== organisationId
      ) {
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
        .select([
          'audit.id',
          'audit.eventType',
          'audit.metadata',
          'audit.createdAt',
          'actor.id',
          'actor.email',
          'actor.firstName',
          'actor.lastName',
        ])
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

      const totalPages = Math.ceil(total / limit);

      const meta = new PaginationMetaDto({
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && total > 0 && totalPages > 0,
      });

      return new ApiResponseDto<
        {
          eventType: string;
          metadata: Record<string, any>;
          id: string;
          actor: {
            email: string;
            firstName: string;
            lastName: string;
          };
        }[],
        PaginationMetaDto
      >({
        data: items as any[],
        meta,
        message: 'Audit data retrieved successfully',
        success: true,
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Error retrieving Audit Logs');
    }
  }

  async streamAuditLogsCsv(
    request: ExRequest,
    queryDto: QueryOrganisationAuditsDto,
  ): Promise<Readable> {
    try {
      const organisationId =
        request?.decodedUser?.organisationId ?? request?.organisation?.id;
      if (
        queryDto.organisationId &&
        queryDto.organisationId !== organisationId
      ) {
        throw new HttpException({ message: 'Not enough access' }, 403);
      }
      const { eventType, actorId, startDate, endDate } = queryDto;

      const queryBuilder = this.auditRepository
        .createQueryBuilder('audit')
        .leftJoinAndSelect('audit.actor', 'actor')
        .select([
          'audit.id',
          'audit.eventType',
          'audit.metadata',
          'audit.createdAt',
          'actor.id',
          'actor.email',
          'actor.firstName',
          'actor.lastName',
        ])
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

      queryBuilder.orderBy('audit.createdAt', 'DESC');

      const csvStream = new Readable({
        read() {}, // No-op, data will be pushed manually
      });

      csvStream.push('ID,Event Type,Actor Email,Created At,Metadata\n');

      const stream = await queryBuilder.stream();

      // TODO: TypeORM queryBuilder.stream() yields raw database rows.
      // Alternatively, fetch in safe chunk loops if dealing with heavy JSONB parsing.

      process.nextTick(async () => {
        try {
          let skip = 0;
          const batchSize = 500;
          let hasMore = true;

          while (hasMore) {
            const batchQuery = queryBuilder.clone().skip(skip).take(batchSize);
            const audits = await batchQuery.getMany();

            if (audits.length === 0) {
              hasMore = false;
              break;
            }

            for (const audit of audits) {
              const actorEmail = audit.actor?.email
                ? `"${audit.actor.email}"`
                : '"System"';
              const eventType = `"${audit.eventType}"`;
              const createdAt = `"${audit.createdAt.toISOString()}"`;
              const metadata = `"${JSON.stringify(audit.metadata || {}).replace(/"/g, '""')}"`;

              const row = `${audit.id},${eventType},${actorEmail},${createdAt},${metadata}\n`;
              csvStream.push(row);
            }

            skip += batchSize;
            if (audits.length < batchSize) {
              hasMore = false;
            }
          }
        } catch (error) {
          csvStream.destroy(error as Error);
        } finally {
          csvStream.push(null);
        }
      });

      return csvStream;
    } catch (error) {
      return handleServiceMethodError(error, 'Error streaming CSV Audit Logs');
    }
  }
}
