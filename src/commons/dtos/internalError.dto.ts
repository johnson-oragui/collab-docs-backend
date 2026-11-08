import { ApiProperty } from '@nestjs/swagger';

export class InternalErrorDto {
  constructor(partial: Partial<InternalErrorDto>) {
    Object.assign(partial, InternalErrorDto);
  }
  @ApiProperty({
    example: 'Internal Server Error',
    required: true,
  })
  message: string = 'Internal Server Error';

  @ApiProperty({
    example: false,
    required: true,
  })
  success: boolean = false;
}
