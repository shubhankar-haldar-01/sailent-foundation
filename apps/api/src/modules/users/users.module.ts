import { Module } from '@nestjs/common';

import { RolesService } from './roles.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/** Staff accounts, roles and the permission catalogue. */
@Module({
  controllers: [UsersController],
  providers: [UsersService, RolesService],
  exports: [UsersService, RolesService],
})
export class UsersModule {}
