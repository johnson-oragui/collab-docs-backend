import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UserService } from '../user/user.service';
import {
  CreateUserRequestDto,
  CreateUserResponseDto,
} from '../user/dto/user.create.dto';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { InternalErrorDto } from '../commons/dtos/internalError.dto';
import { BadRequestErrorDto } from '../commons/dtos/badRequest.dto';

@ApiTags('AUTHENTICATION')
@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  @Post('/signup')
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Creates a user account and hashes password',
  })
  @ApiCreatedResponse({
    description: 'User created successfully',
    type: CreateUserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation Error',
    type: BadRequestErrorDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal Server Error',
    type: InternalErrorDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() createDto: CreateUserRequestDto,
  ): Promise<CreateUserResponseDto> {
    return await this.userService.signup(createDto);
  }
}
