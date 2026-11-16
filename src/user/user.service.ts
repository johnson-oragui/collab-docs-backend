import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request as ExRequest } from 'express';

import { PasswordService } from '../password/password.service';
import { UserEntity } from './user.entity';
import { CurrentUser } from './user.types';
import { ApiResponseDto } from '@/commons/dtos/api-response.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly passwordService: PasswordService,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async getCurrentUser(
    request: ExRequest,
  ): Promise<ApiResponseDto<CurrentUser>> {
    let organisationId: string | undefined = undefined;
    if (request.organisation) organisationId = request.organisation.id;
    if (!organisationId && request.decodedUser)
      organisationId = request.decodedUser.organisationId;
    const user = await this.userRepository.findOne({
      where: {
        id: request.user?.id,
        organisationMemberships: { organisation: { id: organisationId } },
      },
      relations: { profile: true, organisationMemberships: { role: true } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profile: { id: true, avatarUrl: true, bio: true },
        organisationMemberships: {
          id: true,
          role: { name: true, id: true },
          status: true,
        },
      },
    });
    if (!user) {
      throw new HttpException({ message: '', success: false }, 401);
    }

    return new ApiResponseDto<CurrentUser>({
      data: user,
      message: 'User data retrieved successfully.',
      success: true,
    });
  }
}
