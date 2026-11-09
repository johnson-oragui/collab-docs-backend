import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({
    example: true,
    description: 'Indicates whether the request was successful.',
  })
  declare success: boolean;

  @ApiProperty({
    example: 'Request completed successfully.',
    description: 'Human-readable response message.',
  })
  declare message: string;

  @ApiProperty({
    description: 'Response data.',
    type: Object,
  })
  declare data: T;
}