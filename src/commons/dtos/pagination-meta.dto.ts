import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  constructor(partial: Partial<PaginationMetaDto>) {
    Object.assign(this, partial);
  }
  @ApiProperty({
    example: 1,
    description: 'Current page number (1-indexed).',
  })
  declare page: number;

  @ApiProperty({
    example: 100,
    description: 'Total number of items across all pages.',
  })
  declare total: number;

  @ApiProperty({
    example: 10,
    description: 'Number of items returned per page.',
  })
  declare limit: number;

  @ApiProperty({
    example: 10,
    description: 'Total number of pages available.',
  })
  declare totalPages: number;

  @ApiProperty({
    example: true,
    description: 'Whether a next page exists.',
  })
  declare hasNextPage: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether a previous page exists.',
  })
  declare hasPreviousPage: boolean;
}

export interface IPaginationMetaDto {
  page: number;
  total: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
