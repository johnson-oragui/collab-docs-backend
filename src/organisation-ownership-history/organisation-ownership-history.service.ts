import { HttpException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GetOwnershipHistoryQueryDto } from './dto/get-ownership-history.dto';
import { OrganisationOwnershipHistoryEntity } from './organisation-ownership-history.entity';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { type Request as ExRequest } from 'express';

@Injectable()
export class OwnershipHistoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getOwnershipHistory(
    request: ExRequest,
    query: GetOwnershipHistoryQueryDto,
  ) {
    try {
      const organisationId =
        request.organisation?.id ?? request.decodedUser?.organisationId;

      if (!organisationId) {
        throw new HttpException(
          { message: 'Organisation context is required' },
          400,
        );
      }

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const skip = (page - 1) * limit;

      const historyRepo = this.dataSource.getRepository(
        OrganisationOwnershipHistoryEntity,
      );

      const [items, total] = await historyRepo.findAndCount({
        where: {
          organisation: { id: organisationId, isDeleted: false },
          isDeleted: false,
        },
        relations: {
          previousOwner: true,
          newOwner: true,
        },
        select: {
          id: true,
          transferredAt: true,
          reason: true,
          createdAt: true,
          previousOwner: {
            email: true,
            firstName: true,
            lastName: true,
          },
          newOwner: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          transferredAt: 'DESC',
          createdAt: 'DESC',
        },
        take: limit,
        skip,
      });

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return new ApiResponseDto({
        message: 'Ownership history retrieved successfully',
        success: true,
        data: items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to retrieve ownership history',
      );
    }
  }
}
