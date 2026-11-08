import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from './permissions.entity';

@Injectable()
export class PermissionsSeedService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsSeedService.name);

  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
  ) {}

  async onModuleInit() {
    await this.seedPermissions();
  }

  async seedPermissions() {
    this.logger.log('Syncing permissions with PermissionEnum...');

    const validPermissions = PermissionEntity.getValidPermissions();

    const permissionEntities = validPermissions.map((name) => {
      const [resource, action] = name.split(':');
      const description = `Allows user to ${action} ${resource}`;

      return this.permissionRepository.create({
        name,
        description,
      });
    });

    await this.permissionRepository.upsert(permissionEntities, {
      conflictPaths: ['name'], // PostgreSQL unique constraint column
      skipUpdateIfNoValuesChanged: true,
    });

    this.logger.log(
      `Successfully seeded ${validPermissions.length} permissions.`,
    );
  }
}
