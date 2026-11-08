import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  findAll(): Promise<UserEntity[]> {
    return this.userRepository.find();
  }

  async findByEmail(email: string) {
    try {
      return (await this.userRepository.findBy({ email }))?.[0];
    } catch (error) {
      console.error('Error finding user by email: ', error);
      throw error;
    }
  }

  async findById(userId: string) {
    try {
      return (await this.userRepository.find({ where: { id: userId } }))?.[0];
    } catch (error) {
      console.error('Error finding user by ID: ', error);
      throw error;
    }
  }
}
