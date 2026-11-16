import { Context, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { type Request as ExRequest } from 'express';

import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { UserService } from '../user.service';
import { GQLUserModel } from './user.model';
import { UserResponseType, UserResponseDto } from '../dto/me.dto';

@Resolver(() => GQLUserModel)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => UserResponseDto, {
    name: 'me',
    description: 'Retrieves the currently authenticated user profile session.',
  })
  @UseGuards(CustomJwtAuthGuard)
  async getCurrentUser(
    @Context('req') req: ExRequest,
  ): Promise<UserResponseType> {
    return await this.userService.getCurrentUser(req);
  }
}
