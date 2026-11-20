import { ApiProperty } from '@nestjs/swagger';
import { IPaginationMetaDto, PaginationMetaDto } from './pagination-meta.dto';

export class ApiResponseDto<T, M = IPaginationMetaDto> {
  constructor(partial: Partial<ApiResponseDto<T, M>>) {
    Object.assign(this, partial);
  }
  @ApiProperty({
    example: true,
    description: 'Indicates whether the request was successful.',
  })
  success: boolean = true;

  @ApiProperty({
    example: 'Request completed successfully.',
    description: 'Human-readable response message.',
  })
  message: string = 'Operation was successful';

  @ApiProperty({
    description: 'Response data.',
    type: Object,
  })
  declare data: T;

  @ApiProperty({
    description: 'Response pagination meta.',
    example: {
      page: 10,
      total: 10,
      limit: 10,
      totalPages: 10,
      hasNextPage: true,
      hasPreviousPage: true,
    },
    type: () => PaginationMetaDto,
    required: false,
  })
  meta?: M;
}
