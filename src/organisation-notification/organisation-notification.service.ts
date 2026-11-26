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

@Injectable()
export class OrganisationNotificationService {
  private readonly logger = new Logger(OrganisationNotificationService.name);
  private readonly DRAFT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days default
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // private readonly notificationOutboxDispatcher?: NotificationOutboxDispatcherService,
  ) {}

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

  /**
   * Resolves intended membership IDs stored on the draft prior to publication.
   * Adapt this helper if your draft stores intended recipient IDs in a JSON/array
   * column or a dedicated draft-recipients relation rather than NotificationRecipientEntity.
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
