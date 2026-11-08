import { Injectable } from '@nestjs/common';
import { PasswordService } from '../password/password.service';
import {
  CreateUserRequestDto,
  CreateUserResponseDto,
  UserResponseEntity,
} from './dto/user.create.dto';
import { plainToInstance } from 'class-transformer';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { Repository } from 'typeorm';
import { asyncStore } from '@/commons/storage/async-storage';

@Injectable()
export class UserService {
  constructor(
    private readonly passwordService: PasswordService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}


  async signup(
    createDto: CreateUserRequestDto,
  ): Promise<CreateUserResponseDto> {
    const hashPass = await this.passwordService.hash(createDto.password);

    const user = this.userRepository.create({
      password: hashPass,
      firstName: createDto.firstname,
      lastName: createDto.lastname,
      email: createDto.email.toLowerCase(),
      acceptTerms: createDto.acceptTerms,
      requestId: asyncStore.getStore()?.requestId,
    });
    const newUser = await this.userRepository.save(user);

    const sanitizedData = plainToInstance(UserResponseEntity, newUser, {
      excludeExtraneousValues: true,
    });

    return new CreateUserResponseDto({
      data: sanitizedData,
    });
  }
}
