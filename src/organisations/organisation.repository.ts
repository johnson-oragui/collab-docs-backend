import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrganisationEntity } from './organisations.entity';
import { FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class OrganisationRepository {
  constructor(
    @InjectRepository(OrganisationEntity)
    private readonly orgRepo: Repository<OrganisationEntity>,
  ) {}

  async findBy(
    where:
      | FindOptionsWhere<OrganisationEntity>
      | FindOptionsWhere<OrganisationEntity>[],
  ) {
    return await this.orgRepo.findBy(where);
  }
}
