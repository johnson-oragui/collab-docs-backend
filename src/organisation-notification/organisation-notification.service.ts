import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { CreateNotificationDto } from './dto/create.dto';
import { type Request as ExRequest } from 'express';
import { CreatableNotificationStatusEnum } from '@/commons/enums';
import { MembershipPermissionEntity } from '@/membership_permissions/membership_permissions.entity';
import { PermissionEnum } from '@/permissions/permission.registry';
import { OrganisationEntity } from '@/organisations/organisations.entity';
import { OrganisationMembershipEntity } from '@/organisation-memberships/organisation-memberships.entity';
import { NotificationEntity } from '@/notification/notification.entity';
import { NotificationRecipientEntity } from '@/notification-recipients/notification-recipients.entity';
import { NotificationOutboxEntity } from '@/notification-outbox/notification-outbox.entity';
import {
  NotificationOutboxEventTypeEnum,
  NotificationOutboxStatusEnum,
  NotificationStatusEnum,
  NotificationTypeEnum,
  OrganisationMembershipStatusEnum,
  OrganisationStatusEnum,
} from '@/database/database.enums';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';
import { handleServiceMethodError } from '@/commons/util/errorHandler';
import { UpdateNotificationDto } from './dto/update.dto';
import { GQLPaginationMetaModel } from '@/commons/dtos/pagination-meta.dto';
import { GetNotificationsQueryInputDto } from './graphql/dto/get-notifications-input.dto';
import { MarkNotificationDto } from './dto/mark-dto';

@Injectable()
export class OrganisationNotificationService {
  private readonly DEFAULT_PAGE = 1;
  private readonly DEFAULT_LIMIT = 20;
  private readonly MAX_LIMIT = 100;
  private readonly logger = new Logger(OrganisationNotificationService.name);
  private readonly DRAFT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days default
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // private readonly notificationOutboxDispatcher?: NotificationOutboxDispatcherService,
  ) {}

  async markNotificationAsRead(
    request: ExRequest,
    notificationId: string,
    dto: MarkNotificationDto,
  ) {
    try {
      const { organisationId, actorUserId } =
        this.getOrganisationAndActorId(request);

      const targetIds = Array.from(
        new Set([notificationId, ...dto.notificationIds]),
      );

      const result = await this.dataSource.transaction(
        async (entityManager) => {
          const membershipRepo = entityManager.getRepository(
            OrganisationMembershipEntity,
          );
          const notificationRepo =
            entityManager.getRepository(NotificationEntity);
          const recipientRepo = entityManager.getRepository(
            NotificationRecipientEntity,
          );

          const actorMembership =
            request.membership ??
            (await membershipRepo.findOne({
              where: {
                user: { id: actorUserId },
                organisation: { id: organisationId },
                status: OrganisationMembershipStatusEnum.ACTIVE,
                isDeleted: false,
              },
              select: { id: true, status: true },
            }));

          if (!actorMembership) {
            throw new HttpException(
              {
                message:
                  'An active membership in the organisation is required to update notification read state',
              },
              403,
            );
          }

          const primaryNotification = await notificationRepo.findOne({
            where: { id: notificationId },
            select: {
              id: true,
              organisationId: true,
              status: true,
            },
          });

          if (
            !primaryNotification ||
            primaryNotification.organisationId !== organisationId
          ) {
            throw new HttpException({ message: 'Notification not found' }, 404);
          }

          if (primaryNotification.status !== NotificationStatusEnum.PUBLISHED) {
            throw new HttpException(
              {
                message:
                  'Read state can only be updated for published notifications',
              },
              400,
            );
          }

          const primaryRecipient = await recipientRepo.findOne({
            where: {
              notificationId,
              membershipId: actorMembership.id,
            },
            lock: { mode: 'pessimistic_write' },
          });

          if (!primaryRecipient) {
            throw new HttpException(
              {
                message:
                  'No recipient record exists for this membership on the specified notification',
              },
              404,
            );
          }

          const now = new Date();
          const batchRecipientIds =
            targetIds.length > 1
              ? await recipientRepo
                  .createQueryBuilder('recipient')
                  .innerJoin('recipient.notification', 'notification')
                  .where('recipient.membershipId = :membershipId', {
                    membershipId: actorMembership.id,
                  })
                  .andWhere('recipient.notificationId IN (:...ids)', {
                    ids: targetIds,
                  })
                  .andWhere('notification.organisationId = :organisationId', {
                    organisationId,
                  })
                  .andWhere('notification.status = :status', {
                    status: NotificationStatusEnum.PUBLISHED,
                  })
                  .getMany()
              : [primaryRecipient];

          const updatedItems: Array<{
            notificationId: string;
            recipientId: string;
            membershipId: string;
            readAt: Date | null;
            isRead: boolean;
            alreadyInRequestedState: boolean;
          }> = [];

          for (const recipient of batchRecipientIds) {
            const targetRow =
              recipient.id === primaryRecipient.id
                ? primaryRecipient
                : recipient;

            if (dto.read) {
              if (targetRow.readAt !== null) {
                updatedItems.push({
                  notificationId: targetRow.notificationId,
                  recipientId: targetRow.id,
                  membershipId: targetRow.membershipId,
                  readAt: targetRow.readAt,
                  isRead: true,
                  alreadyInRequestedState: true,
                });
                continue;
              }

              targetRow.readAt = now;
              await recipientRepo.save(targetRow);

              updatedItems.push({
                notificationId: targetRow.notificationId,
                recipientId: targetRow.id,
                membershipId: targetRow.membershipId,
                readAt: targetRow.readAt,
                isRead: true,
                alreadyInRequestedState: false,
              });
            } else {
              if (targetRow.readAt === null) {
                updatedItems.push({
                  notificationId: targetRow.notificationId,
                  recipientId: targetRow.id,
                  membershipId: targetRow.membershipId,
                  readAt: null,
                  isRead: false,
                  alreadyInRequestedState: true,
                });
                continue;
              }

              targetRow.readAt = null;
              await recipientRepo.save(targetRow);

              updatedItems.push({
                notificationId: targetRow.notificationId,
                recipientId: targetRow.id,
                membershipId: targetRow.membershipId,
                readAt: null,
                isRead: false,
                alreadyInRequestedState: false,
              });
            }
          }

          const primaryState = updatedItems.find(
            (item) => item.notificationId === notificationId,
          )!;

          return {
            primary: primaryState,
            items: updatedItems,
          };
        },
      );

      this.logger.debug(
        `Updated read=${dto.read} for membership ${result.primary.membershipId} on notification ${notificationId}`,
      );

      const message = dto.read
        ? result.primary.alreadyInRequestedState
          ? 'Notification is already marked as read'
          : 'Notification marked as read'
        : result.primary.alreadyInRequestedState
          ? 'Notification is already marked as unread'
          : 'Notification marked as unread';

      return new ApiResponseDto({
        message,
        success: true,
        data: {
          ...result.primary,
          updatedCount: result.items.length,
          items: result.items,
        },
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to update notification read state',
      );
    }
  }

  async getMembershipNotifications(
    request: ExRequest,
    query: GetNotificationsQueryInputDto,
  ) {
    try {
      const { organisationId, actorUserId } =
        this.getOrganisationAndActorId(request);

      const rawPage = query?.page ?? this.DEFAULT_PAGE;
      const rawLimit = query?.limit ?? this.DEFAULT_LIMIT;

      if (!Number.isInteger(rawPage) || rawPage < 1) {
        throw new HttpException(
          {
            message:
              'Page must be a positive integer greater than or equal to 1',
          },
          400,
        );
      }

      if (!Number.isInteger(rawLimit) || rawLimit < 1) {
        throw new HttpException(
          {
            message:
              'Limit must be a positive integer greater than or equal to 1',
          },
          400,
        );
      }

      const page = rawPage;
      const limit = Math.min(rawLimit, this.MAX_LIMIT);
      const offset = (page - 1) * limit;

      const membershipRepo = this.dataSource.getRepository(
        OrganisationMembershipEntity,
      );

      let targetMembership: OrganisationMembershipEntity | null = null;

      if (query?.membershipId) {
        targetMembership = await membershipRepo.findOne({
          where: { id: query.membershipId },
          relations: { user: true, organisation: true },
        });

        if (!targetMembership) {
          throw new HttpException({ message: 'Membership not found' }, 404);
        }

        const membershipOrgId =
          targetMembership.organisation?.id ??
          (targetMembership as any).organisationId;
        const membershipUserId =
          targetMembership.user?.id ?? (targetMembership as any).userId;

        if (membershipOrgId !== organisationId) {
          throw new HttpException(
            {
              message: 'Membership does not belong to the active organisation',
            },
            403,
          );
        }

        if (membershipUserId !== actorUserId) {
          throw new HttpException(
            {
              message:
                'You are not authorised to read notifications for another member',
            },
            403,
          );
        }

        if (
          targetMembership.status !== OrganisationMembershipStatusEnum.ACTIVE ||
          (targetMembership as any).isDeleted === true
        ) {
          throw new HttpException({ message: 'Membership is not active' }, 403);
        }
      } else {
        targetMembership = await membershipRepo.findOne({
          where: {
            user: { id: actorUserId },
            organisation: { id: organisationId },
            status: OrganisationMembershipStatusEnum.ACTIVE,
            isDeleted: false,
          },
        });

        if (!targetMembership) {
          throw new HttpException(
            {
              message:
                'Active membership in the current organisation not found',
            },
            404,
          );
        }
      }

      const qb = this.dataSource
        .getRepository(NotificationRecipientEntity)
        .createQueryBuilder('recipient')
        .innerJoinAndSelect('recipient.notification', 'notification')
        .where('recipient.membershipId = :membershipId', {
          membershipId: targetMembership.id,
        })
        .andWhere('notification.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('notification.status = :status', {
          status: NotificationStatusEnum.PUBLISHED,
        });

      if (query?.unreadOnly) {
        qb.andWhere('recipient.readAt IS NULL');
      }

      if (query?.type) {
        qb.andWhere('notification.type = :type', { type: query.type });
      }

      qb.orderBy('notification.publishedAt', 'DESC', 'NULLS LAST')
        .addOrderBy('notification.id', 'DESC')
        .skip(offset)
        .take(limit);

      const [rows, total] = await qb.getManyAndCount();

      const items = rows.map((row) => ({
        id: row.notification.id,
        recipientId: row.id,
        membershipId: row.membershipId,
        title: row.notification.title,
        message: row.notification.message,
        type: row.notification.type,
        publishedAt: row.notification.publishedAt,
        readAt: row.readAt,
        isRead: Boolean(row.readAt),
      }));

      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

      const meta = new GQLPaginationMetaModel({
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      });

      return {
        success: true,
        message: 'Membership notifications retrieved successfully',
        data: items,
        meta,
      };
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to retrieve membership notifications',
      );
    }
  }

  async createNotification(dto: CreateNotificationDto, request: ExRequest) {
    try {
      const { organisationId, actorUserId } =
        this.getOrganisationAndActorId(request);

      const requestedStatus = dto.status;
      if (
        requestedStatus !== CreatableNotificationStatusEnum.DRAFT &&
        requestedStatus !== CreatableNotificationStatusEnum.PUBLISHED
      ) {
        throw new HttpException(
          { message: 'Notification status must be DRAFT or PUBLISHED' },
          400,
        );
      }

      // deduplicate supplied recipient membership IDs while preserving order
      const rawRecipientIds = dto.recipientMembershipIds ?? [];
      const uniqueRecipientIds = Array.from(new Set(rawRecipientIds));

      if (
        requestedStatus === CreatableNotificationStatusEnum.PUBLISHED &&
        uniqueRecipientIds.length === 0
      ) {
        throw new HttpException(
          {
            message:
              'At least one recipient membership is required to publish a notification',
          },
          400,
        );
      }

      if (requestedStatus === CreatableNotificationStatusEnum.PUBLISHED) {
        // ensure publish permission is present even if called programmatically
        const requestPermissions: string[] =
          request.membership?.permissions?.map(
            (p: MembershipPermissionEntity) => p.permission.name,
          ) ?? [];
        if (
          Array.isArray(requestPermissions) &&
          requestPermissions.length > 0 &&
          !requestPermissions.includes(PermissionEnum.NOTIFICATION.PUBLISH)
        ) {
          throw new HttpException(
            {
              message:
                'Missing required permission for notification publishing!',
            },
            403,
          );
        }
      }

      const { notification, outboxIds } = await this.dataSource.transaction(
        async (entityManager) => {
          const orgRepo = entityManager.getRepository(OrganisationEntity);
          const membershipRepo = entityManager.getRepository(
            OrganisationMembershipEntity,
          );
          const notificationRepo =
            entityManager.getRepository(NotificationEntity);
          const recipientRepo = entityManager.getRepository(
            NotificationRecipientEntity,
          );
          const outboxRepo = entityManager.getRepository(
            NotificationOutboxEntity,
          );

          const organisation = await orgRepo.findOne({
            where: { id: organisationId, isDeleted: false },
            select: { id: true, status: true },
          });

          if (!organisation) {
            throw new HttpException({ message: 'Organisation not found' }, 404);
          }

          if (organisation.status !== OrganisationStatusEnum.ACTIVE) {
            throw new HttpException(
              { message: 'Organisation is not active' },
              400,
            );
          }

          const creatorMembership =
            request.membership?.id &&
            request.membership?.status ===
              OrganisationMembershipStatusEnum.ACTIVE
              ? request.membership
              : await membershipRepo.findOne({
                  where: {
                    user: { id: actorUserId },
                    organisation: { id: organisationId },
                    status: OrganisationMembershipStatusEnum.ACTIVE,
                    isDeleted: false,
                  },
                  select: { id: true, status: true },
                });

          if (
            !creatorMembership ||
            creatorMembership.status !== OrganisationMembershipStatusEnum.ACTIVE
          ) {
            throw new HttpException(
              {
                message:
                  'An active membership in the organisation is required to create notifications',
              },
              403,
            );
          }

          let validRecipients: OrganisationMembershipEntity[] = [];

          if (uniqueRecipientIds.length > 0) {
            validRecipients = await membershipRepo.find({
              where: {
                id: In(uniqueRecipientIds),
                organisation: { id: organisationId },
                status: OrganisationMembershipStatusEnum.ACTIVE,
                isDeleted: false,
              },
              select: { id: true, status: true },
            });

            const validIdSet = new Set(validRecipients.map((m) => m.id));
            const invalidRecipientIds = uniqueRecipientIds.filter(
              (id) => !validIdSet.has(id),
            );

            if (invalidRecipientIds.length > 0) {
              throw new HttpException(
                {
                  message:
                    'One or more recipient membership IDs are invalid, inactive, or outside this organisation',
                  invalidRecipientIds,
                },
                400,
              );
            }
          }

          const now = new Date();
          const isDraft =
            requestedStatus === CreatableNotificationStatusEnum.DRAFT;

          const createdNotification = await notificationRepo.save(
            notificationRepo.create({
              organisationId,
              organisation: { id: organisationId } as OrganisationEntity,
              createdByMembershipId: creatorMembership.id,
              createdByMembership: {
                id: creatorMembership.id,
              } as OrganisationMembershipEntity,
              title: dto.title.trim(),
              message: dto.message.trim(),
              type: dto.type ?? NotificationTypeEnum.ANNOUNCEMENT,
              status: isDraft
                ? NotificationStatusEnum.DRAFT
                : NotificationStatusEnum.PUBLISHED,
              draftExpiresAt: isDraft
                ? new Date(now.getTime() + this.DRAFT_RETENTION_MS)
                : null,
              publishedAt: isDraft ? null : now,
            }),
          );

          const createdOutboxIds: string[] = [];

          if (validRecipients.length > 0) {
            const recipientRows = validRecipients.map((member) =>
              recipientRepo.create({
                notificationId: createdNotification.id,
                notification: {
                  id: createdNotification.id,
                } as NotificationEntity,
                membershipId: member.id,
                membership: {
                  id: member.id,
                } as OrganisationMembershipEntity,
                readAt: null,
              }),
            );
            await recipientRepo.save(recipientRows);

            if (!isDraft) {
              const outboxRows = validRecipients.map((member) =>
                outboxRepo.create({
                  notificationId: createdNotification.id,
                  notification: {
                    id: createdNotification.id,
                  } as NotificationEntity,
                  recipientMembershipId: member.id,
                  eventType:
                    NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED,
                  status: NotificationOutboxStatusEnum.PENDING,
                  attempts: 0,
                  nextAttemptAt: now,
                  dispatchedAt: null,
                  lastError: null,
                }),
              );
              const savedOutbox = await outboxRepo.save(outboxRows);
              createdOutboxIds.push(...savedOutbox.map((row) => row.id));
            }
          }

          return {
            notification: {
              id: createdNotification.id,
              createdAt: createdNotification.createdAt,
              draftExpiresAt: createdNotification.draftExpiresAt,
              status: createdNotification.status,
              publishedAt: createdNotification.publishedAt,
              organisationId,
              createdByMembershipId: createdNotification.createdByMembershipId,
            },
            outboxIds: createdOutboxIds,
          };
        },
      );

      // TODO: dispatch outbox records only after transaction commits
      if (outboxIds.length > 0) {
        this.logger.debug(
          `Committed ${outboxIds.length} notification outbox record(s) for notification ${notification.id}`,
        );
      }

      return new ApiResponseDto({
        message:
          notification.status === NotificationStatusEnum.DRAFT
            ? 'Notification draft created successfully'
            : 'Notification published successfully',
        success: true,
        data: notification,
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Failed to create notification');
    }
  }

  async updateNotification(
    request: ExRequest,
    dto: UpdateNotificationDto,
    notificationId: string,
  ) {
    try {
      const { organisationId, actorUserId } =
        this.getOrganisationAndActorId(request);

      const existing = await this.dataSource
        .getRepository(NotificationEntity)
        .findOne({
          where: { id: notificationId },
          select: {
            id: true,
            organisationId: true,
            status: true,
            draftExpiresAt: true,
          },
        });

      if (!existing) {
        throw new HttpException({ message: 'Notification not found' }, 404);
      }

      if (existing.organisationId !== organisationId) {
        throw new HttpException({ message: 'Notification not found' }, 404);
      }

      const activeActorMembership =
        request.membership ??
        (await this.dataSource
          .getRepository(OrganisationMembershipEntity)
          .findOne({
            where: {
              user: { id: actorUserId },
              organisation: { id: organisationId },
              status: OrganisationMembershipStatusEnum.ACTIVE,
              isDeleted: false,
            },
            select: { id: true, status: true },
          }));

      if (!activeActorMembership) {
        throw new HttpException(
          {
            message:
              'An active membership in the organisation is required to update drafts',
          },
          403,
        );
      }

      if (existing.status !== NotificationStatusEnum.DRAFT) {
        throw new HttpException(
          {
            message: `Cannot edit a notification with status ${existing.status}. Only DRAFT notifications can be edited.`,
          },
          409,
        );
      }

      const now = new Date();
      // delete expired notification
      if (
        existing.draftExpiresAt &&
        existing.draftExpiresAt.getTime() <= now.getTime()
      ) {
        await this.dataSource.transaction(async (entityManager) => {
          await entityManager
            .getRepository(NotificationRecipientEntity)
            .delete({ notificationId: existing.id });
          await entityManager
            .getRepository(NotificationEntity)
            .delete({ id: existing.id });
        });

        throw new HttpException(
          {
            message: 'Draft has expired and has been removed',
          },
          410,
        );
      }

      const updatedNotification = await this.dataSource.transaction(
        async (entityManager) => {
          const orgRepo = entityManager.getRepository(OrganisationEntity);
          const membershipRepo = entityManager.getRepository(
            OrganisationMembershipEntity,
          );
          const notificationRepo =
            entityManager.getRepository(NotificationEntity);
          const recipientRepo = entityManager.getRepository(
            NotificationRecipientEntity,
          );

          const organisation =
            request.organisation ??
            (await orgRepo.findOne({
              where: { id: organisationId, isDeleted: false },
              select: { id: true, status: true },
            }));

          if (!organisation) {
            throw new HttpException({ message: 'Organisation not found' }, 404);
          }

          if (organisation.status !== OrganisationStatusEnum.ACTIVE) {
            throw new HttpException(
              { message: 'Organisation is not active' },
              400,
            );
          }

          const draft = await notificationRepo.findOne({
            where: { id: notificationId, organisationId },
          });

          if (!draft) {
            throw new HttpException({ message: 'Notification not found' }, 404);
          }

          if (draft.status !== NotificationStatusEnum.DRAFT) {
            throw new HttpException(
              {
                message: `Cannot edit a notification with status ${draft.status}. Only DRAFT notifications can be edited.`,
              },
              409,
            );
          }

          const txNow = new Date();
          if (
            draft.draftExpiresAt &&
            draft.draftExpiresAt.getTime() <= txNow.getTime()
          ) {
            throw new HttpException({ message: 'Draft has expired' }, 410);
          }

          if (dto.recipientMembershipIds !== undefined) {
            const uniqueRecipientIds = Array.from(
              new Set(dto.recipientMembershipIds),
            );

            if (uniqueRecipientIds.length > 0) {
              const validRecipients = await membershipRepo.find({
                where: {
                  id: In(uniqueRecipientIds),
                  organisation: { id: organisationId },
                  status: OrganisationMembershipStatusEnum.ACTIVE,
                  isDeleted: false,
                },
                select: { id: true },
              });

              const validIdSet = new Set(validRecipients.map((m) => m.id));
              const invalidRecipientIds = uniqueRecipientIds.filter(
                (id) => !validIdSet.has(id),
              );

              if (invalidRecipientIds.length > 0) {
                throw new HttpException(
                  {
                    message:
                      'One or more recipient membership IDs are invalid, inactive, or outside this organisation',
                    invalidRecipientIds,
                  },
                  400,
                );
              }
            }

            // Replace draft's recipient
            await recipientRepo.delete({ notificationId: draft.id });
            if (uniqueRecipientIds.length > 0) {
              const newRecipients = uniqueRecipientIds.map((membershipId) =>
                recipientRepo.create({
                  notificationId: draft.id,
                  notification: { id: draft.id } as NotificationEntity,
                  membershipId,
                  membership: {
                    id: membershipId,
                  } as OrganisationMembershipEntity,
                  readAt: null,
                }),
              );
              await recipientRepo.save(newRecipients);
            }
          }

          if (dto.title !== undefined) {
            draft.title = dto.title.trim();
          }
          if (dto.message !== undefined) {
            draft.message = dto.message.trim();
          }
          if (dto.type !== undefined) {
            draft.type = dto.type;
          }

          const updatedNotification = await notificationRepo.save(draft);
          return {
            id: updatedNotification.id,
            createdAt: updatedNotification.createdAt,
            draftExpiresAt: updatedNotification.draftExpiresAt,
            status: updatedNotification.status,
            publishedAt: updatedNotification.publishedAt,
            organisationId,
            title: updatedNotification.title,
            message: updatedNotification.message,
            type: updatedNotification.type,
            createdByMembershipId: updatedNotification.createdByMembershipId,
          };
        },
      );

      return new ApiResponseDto({
        message: 'Notification draft updated successfully',
        success: true,
        data: updatedNotification,
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to update notification draft',
      );
    }
  }

  async publishNotification(request: ExRequest, notificationId: string) {
    try {
      const { organisationId, actorUserId } =
        this.getOrganisationAndActorId(request);

      const organisation =
        request.organisation ??
        (await this.dataSource.getRepository(OrganisationEntity).findOne({
          where: { id: organisationId, isDeleted: false },
          select: { id: true, status: true },
        }));

      if (!organisation) {
        throw new HttpException({ message: 'Organisation not found' }, 404);
      }

      if (organisation.status !== OrganisationStatusEnum.ACTIVE) {
        throw new HttpException({ message: 'Organisation is not active' }, 400);
      }

      const draft = await this.dataSource
        .getRepository(NotificationEntity)
        .findOne({
          where: { id: notificationId },
          relations: { recipients: true },
        });

      if (!draft || draft.organisationId !== organisationId) {
        throw new HttpException({ message: 'Notification not found' }, 404);
      }

      if (draft.status === NotificationStatusEnum.PUBLISHED) {
        throw new HttpException(
          { message: 'Notification has already been published' },
          409,
        );
      }

      if (draft.status !== NotificationStatusEnum.DRAFT) {
        throw new HttpException(
          {
            message: `Cannot publish notification with status ${draft.status}`,
          },
          409,
        );
      }

      if (draft.draftExpiresAt && draft.draftExpiresAt <= new Date()) {
        await this.dataSource.transaction(async (entityManager) => {
          await entityManager
            .getRepository(NotificationRecipientEntity)
            .delete({ notificationId: draft.id });
          await entityManager
            .getRepository(NotificationEntity)
            .delete({ id: draft.id });
        });

        throw new HttpException(
          { message: 'Draft has expired and cannot be published' },
          410,
        );
      }
      if (!draft.title?.trim() || !draft.message?.trim()) {
        throw new HttpException(
          {
            message:
              'Notification title and message must be non-empty before publishing',
          },
          400,
        );
      }

      const intendedRecipientIds = Array.from(
        new Set(this.extractIntendedRecipientIds(draft)),
      );

      const { publishedNotification, outboxIds } =
        await this.dataSource.transaction(async (entityManager) => {
          const membershipRepo = entityManager.getRepository(
            OrganisationMembershipEntity,
          );
          const notificationRepo =
            entityManager.getRepository(NotificationEntity);
          const recipientRepo = entityManager.getRepository(
            NotificationRecipientEntity,
          );
          const outboxRepo = entityManager.getRepository(
            NotificationOutboxEntity,
          );

          const actorMembership =
            request.membership ??
            (await membershipRepo.findOne({
              where: {
                user: { id: actorUserId },
                organisation: { id: organisationId },
                status: OrganisationMembershipStatusEnum.ACTIVE,
                isDeleted: false,
              },
              select: { id: true, status: true },
            }));

          if (!actorMembership) {
            throw new HttpException(
              {
                message:
                  'An active membership in the organisation is required to publish notifications',
              },
              403,
            );
          }

          // lock the notification row so concurrent publish requests serialize
          // and only one can transition DRAFT -> PUBLISHED.
          const draft = await notificationRepo.findOne({
            where: { id: notificationId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!draft) {
            throw new HttpException({ message: 'Notification not found' }, 404);
          }
          if (draft.status === NotificationStatusEnum.PUBLISHED) {
            throw new HttpException(
              { message: 'Notification has already been published' },
              409,
            );
          }

          if (draft.status !== NotificationStatusEnum.DRAFT) {
            throw new HttpException(
              {
                message: `Cannot publish notification with status ${draft.status}`,
              },
              409,
            );
          }

          const now = new Date();

          if (intendedRecipientIds.length === 0) {
            throw new HttpException(
              {
                message:
                  'At least one active recipient membership is required to publish a notification',
              },
              400,
            );
          }

          // revalidate every intended recipient
          const activeRecipients = await membershipRepo.find({
            where: {
              id: In(intendedRecipientIds),
              organisation: { id: organisationId },
              status: OrganisationMembershipStatusEnum.ACTIVE,
              isDeleted: false,
            },
            select: { id: true },
          });

          const activeIdSet = new Set(activeRecipients.map((m) => m.id));
          const invalidOrInactiveIds = intendedRecipientIds.filter(
            (id) => !activeIdSet.has(id),
          );

          if (invalidOrInactiveIds.length > 0) {
            throw new HttpException(
              {
                message:
                  'One or more intended recipients are no longer active members of this organisation',
                invalidRecipientIds: invalidOrInactiveIds,
              },
              400,
            );
          }

          // guard against any existing recipient/outbox rows if draft rows existed
          await recipientRepo.delete({ notificationId: draft.id });
          await outboxRepo.delete({ notificationId: draft.id });

          draft.title = draft.title.trim();
          draft.message = draft.message.trim();
          draft.status = NotificationStatusEnum.PUBLISHED;
          draft.publishedAt = now;
          draft.draftExpiresAt = null;

          const savedNotification = await notificationRepo.save(draft);

          const recipientRows = activeRecipients.map((member) =>
            recipientRepo.create({
              notificationId: savedNotification.id,
              notification: {
                id: savedNotification.id,
              } as NotificationEntity,
              membershipId: member.id,
              membership: {
                id: member.id,
              } as OrganisationMembershipEntity,
              readAt: null,
            }),
          );
          await recipientRepo.save(recipientRows);

          const outboxRows = activeRecipients.map((member) =>
            outboxRepo.create({
              notificationId: savedNotification.id,
              notification: {
                id: savedNotification.id,
              } as NotificationEntity,
              recipientMembershipId: member.id,
              eventType: NotificationOutboxEventTypeEnum.NOTIFICATION_PUBLISHED,
              status: NotificationOutboxStatusEnum.PENDING,
              attempts: 0,
              nextAttemptAt: now,
              dispatchedAt: null,
              lastError: null,
            }),
          );
          const savedOutbox = await outboxRepo.save(outboxRows);
          const {
            createdAt,
            createdByMembership,
            createdByMembershipId,
            draftExpiresAt,
            id,
            message,
            publishedAt,
            status,
            title,
            type,
          } = savedNotification;

          return {
            publishedNotification: {
              createdAt,
              createdByMembership,
              createdByMembershipId,
              draftExpiresAt,
              id,
              message,
              publishedAt,
              status,
              title,
              type,
              organisationId,
            },
            outboxIds: savedOutbox.map((row) => row.id),
          };
        });

      this.logger.debug(
        `TODO: Published notification ${publishedNotification.id} and scheduled ${outboxIds.length} outbox record(s)`,
      );

      return new ApiResponseDto({
        message: 'Notification published and delivery scheduled',
        success: true,
        data: publishedNotification,
      });
    } catch (error) {
      return handleServiceMethodError(error, 'Failed to publish notification');
    }
  }

  async deleteNotification(request: ExRequest, notificationId: string) {
    try {
      const { organisationId } = this.getOrganisationAndActorId(request);

      const existing = await this.dataSource
        .getRepository(NotificationEntity)
        .findOne({
          where: { id: notificationId },
          select: {
            id: true,
            organisationId: true,
            status: true,
            publishedAt: true,
            draftExpiresAt: true,
          },
        });

      if (!existing || existing.organisationId !== organisationId) {
        throw new HttpException({ message: 'Notification not found' }, 404);
      }

      if (
        existing.status === NotificationStatusEnum.PUBLISHED ||
        existing.publishedAt !== null
      ) {
        throw new HttpException(
          {
            message: 'Published notifications cannot be deleted.',
          },
          409,
        );
      }

      if (existing.status !== NotificationStatusEnum.DRAFT) {
        throw new HttpException(
          {
            message: `Cannot delete notification with status ${existing.status}. Only DRAFT notifications can be deleted.`,
          },
          409,
        );
      }

      const now = new Date();
      if (
        existing.draftExpiresAt &&
        existing.draftExpiresAt.getTime() <= now.getTime()
      ) {
        await this.dataSource.transaction(async (entityManager) => {
          const outboxCount = await entityManager
            .getRepository(NotificationOutboxEntity)
            .count({ where: { notificationId: existing.id } });

          if (outboxCount > 0) {
            this.logger.error(
              `Integrity issue on expired draft ${existing.id}: found ${outboxCount} outbox record(s)`,
            );
            throw new HttpException(
              {
                message:
                  'Draft has unexpected outbox records; manual integrity investigation required',
              },
              409,
            );
          }

          await entityManager
            .getRepository(NotificationRecipientEntity)
            .delete({ notificationId: existing.id });
          await entityManager
            .getRepository(NotificationEntity)
            .delete({ id: existing.id });
        });

        throw new HttpException(
          { message: 'Draft has expired and has been removed' },
          410,
        );
      }

      await this.dataSource.transaction(async (entityManager) => {
        const notificationRepo =
          entityManager.getRepository(NotificationEntity);
        const recipientRepo = entityManager.getRepository(
          NotificationRecipientEntity,
        );
        const outboxRepo = entityManager.getRepository(
          NotificationOutboxEntity,
        );

        const draft = await notificationRepo.findOne({
          where: { id: notificationId, organisationId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!draft) {
          throw new HttpException({ message: 'Notification not found' }, 404);
        }

        if (
          draft.status === NotificationStatusEnum.PUBLISHED ||
          draft.publishedAt !== null
        ) {
          throw new HttpException(
            {
              message:
                'Published notifications cannot be deleted through the draft deletion endpoint',
            },
            409,
          );
        }

        if (draft.status !== NotificationStatusEnum.DRAFT) {
          throw new HttpException(
            {
              message: `Cannot delete notification with status ${draft.status}`,
            },
            409,
          );
        }

        const outboxCount = await outboxRepo.count({
          where: { notificationId: draft.id },
        });
        if (outboxCount > 0) {
          this.logger.error(
            `Integrity issue on draft ${draft.id}: found ${outboxCount} outbox record(s) before deletion`,
          );
          throw new HttpException(
            {
              message:
                'Draft has unexpected outbox records and cannot be deleted automatically',
            },
            409,
          );
        }

        const existingRecipientCount = await recipientRepo.count({
          where: { notificationId: draft.id },
        });
        if (existingRecipientCount > 0) {
          this.logger.warn(
            `Draft ${draft.id} has ${existingRecipientCount} recipient row(s); cleaning up draft associations`,
          );
          await recipientRepo.delete({ notificationId: draft.id });
        }

        await notificationRepo.delete({ id: draft.id });
      });

      return new ApiResponseDto({
        message: 'Notification draft deleted successfully',
        success: true,
        data: { id: notificationId, deleted: true },
      });
    } catch (error) {
      return handleServiceMethodError(
        error,
        'Failed to delete notification draft',
      );
    }
  }

  /**
   * Resolves intended membership IDs stored on the draft prior to publication.
   */
  private extractIntendedRecipientIds(
    draft: NotificationEntity,
    intendedRecipientMembershipIds?: string[] | null,
  ): string[] {
    if (Array.isArray(intendedRecipientMembershipIds)) {
      return intendedRecipientMembershipIds;
    }
    if (Array.isArray(draft.recipients)) {
      return draft.recipients.map((r) => r.membershipId);
    }
    return [];
  }

  private getOrganisationAndActorId(request: ExRequest) {
    const organisationId =
      request.organisation?.id ?? request.decodedUser?.organisationId;

    if (!organisationId) {
      throw new HttpException(
        { message: 'Organisation context is required' },
        400,
      );
    }
    const actorUserId = request.user?.id ?? request.decodedUser?.id;
    if (!actorUserId) {
      throw new HttpException({ message: 'Unauthorized' }, 401);
    }
    return { organisationId, actorUserId };
  }
}
