import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  OrganisationMembershipStatusEnum,
  type TOrganisationMembershipStatusEnum,
} from '@/database/database.enums';
import { createGqlResponseLoader } from '@/commons/util/createGQLResponseLoader';
import { GQLOrganisationMembershipModel } from '../organisation-memberships.model';
import { GQLPaginationMetaModel } from '@/commons/dtos/pagination-meta.dto';

@InputType({
  description:
    'Filters and pagination options for querying organisation memberships.',
})
export class GetOrganisationMembershipsInput {
  @Field(() => ID, {
    nullable: true,
    description: 'Filter by a specific membership ID (UUID).',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Filter by member email address.',
  })
  @IsOptional()
  @IsEmail()
  memberEmail?: string;

  @Field(() => OrganisationMembershipStatusEnum, {
    nullable: true,
    description: 'Filter by membership status.',
  })
  @IsOptional()
  @IsEnum(OrganisationMembershipStatusEnum)
  status?: TOrganisationMembershipStatusEnum;

  @Field(() => Date, {
    nullable: true,
    description: 'Filter memberships suspended on or before this timestamp.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  suspendedTill?: Date;

  @Field(() => Date, {
    nullable: true,
    description:
      'Filter by lower bound (inclusive) of suspendedTill timestamp.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  suspendedFrom?: Date;

  @Field(() => Date, {
    nullable: true,
    description:
      'Filter by upper bound (inclusive) of suspendedTill timestamp.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  suspendedTo?: Date;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 1,
    description: 'Page number (1-indexed).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 10,
    description: 'Number of records per page.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export const OrganisationMembershipsResponseDto = createGqlResponseLoader(
  GQLOrganisationMembershipModel,
  GQLPaginationMetaModel,
  { isArray: true },
);

export const OrganisationMembershipResponseDto = createGqlResponseLoader(
  GQLOrganisationMembershipModel,
  GQLPaginationMetaModel,
  { isArray: false },
);

export type OrganisationMembershipsResponseType = InstanceType<
  typeof OrganisationMembershipsResponseDto
>;
