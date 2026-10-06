import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { NotFoundException } from '../../common/exceptions.js';
import { RolesService } from './roles.service.js';
import { UsersService } from './users.service.js';
import {
  AssignRolesDto,
  InviteUserDto,
  StatusChangeDto,
  UpdateUserDto,
  UserResponseDto,
  assignRolesSchema,
  idParamSchema,
  inviteUserSchema,
  statusChangeSchema,
  updateUserSchema,
  userListQuerySchema,
} from './dto/users.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * Staff account administration.
 *
 * Every route is permission-gated; the four that change what someone can do or
 * whether they can sign in are additionally `@Sensitive()`, which requires a
 * re-authentication within the last five minutes (decision A9).
 *
 * The permission check happens HERE, server-side, on every request. The admin
 * UI hides controls the user cannot use, but that is cosmetic — hiding a button
 * is a courtesy, not a control.
 */
@ApiTags('admin: users')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
  ) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), never a raw X-Forwarded-For.
      ip: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  // --- Staff accounts ------------------------------------------------------

  @RequirePermission('user.read')
  @Get('users')
  @ApiOperation({ summary: 'List staff accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max 100' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['invited', 'active', 'inactive', 'suspended'],
  })
  @ApiQuery({ name: 'role', required: false, example: 'CONTENT_MANAGER' })
  @ApiQuery({ name: 'q', required: false, description: 'Search name or email' })
  @ApiQuery({ name: 'sort', required: false, example: '-createdAt' })
  @ApiResponse({ status: 200, type: UserResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Missing user.read' })
  list(@Query(new ZodValidationPipe(userListQuerySchema)) query: never) {
    return this.users.list(query);
  }

  @RequirePermission('user.read')
  @Get('users/:id')
  @ApiOperation({ summary: 'One staff account with its roles' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'No such account' })
  get(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    return this.users.getById(params.id);
  }

  @RequirePermission('user.invite')
  @Sensitive()
  @Post('users')
  @ApiOperation({
    summary: 'Invite a staff member',
    description:
      'Creates the account in `invited` state with no usable password. Requires a re-authentication within the last five minutes.',
  })
  @ApiBody({ type: InviteUserDto })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 403, description: 'Missing user.invite, or REAUTH_REQUIRED' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  invite(
    @Body(new ZodValidationPipe(inviteUserSchema))
    body: {
      email: string;
      firstName: string;
      lastName?: string;
      phone?: string;
      roleKeys: string[];
    },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.users.invite(body, actor, this.context(request));
  }

  @RequirePermission('user.invite')
  @Sensitive()
  @Post('users/:id/invitation')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send a fresh invitation link',
    description:
      'Only for an account still `invited`. Earlier links stop working. Requires a re-authentication within the last five minutes.',
  })
  @ApiResponse({ status: 403, description: 'Missing user.invite, or REAUTH_REQUIRED' })
  @ApiResponse({ status: 409, description: 'The account has already accepted its invitation' })
  resendInvitation(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.users.resendInvitation(params.id, actor, this.context(request));
  }

  @RequirePermission('user.update')
  @Patch('users/:id')
  @ApiOperation({ summary: 'Edit a staff account profile' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateUserSchema))
    body: { firstName?: string; lastName?: string; phone?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.users.update(params.id, body, actor, this.context(request));
  }

  @RequirePermission('user.assign_role')
  @Sensitive()
  @Post('users/:id/roles')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Replace a user’s roles',
    description:
      'Nobody may change their own roles, whatever they hold. Always writes a `critical` audit row.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AssignRolesDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Missing user.assign_role, REAUTH_REQUIRED, or self-assignment',
  })
  assignRoles(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(assignRolesSchema)) body: { roleKeys: string[]; reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.users.assignRoles(params.id, body, actor, this.context(request));
  }

  @RequirePermission('user.suspend')
  @Sensitive()
  @Post('users/:id/suspend')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Suspend a staff account',
    description: 'Revokes every live session immediately, rather than waiting for token expiry.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: StatusChangeDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  suspend(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(statusChangeSchema)) body: { reason: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.users.setStatus(params.id, 'suspended', body.reason, actor, this.context(request));
  }

  @RequirePermission('user.suspend')
  @Sensitive()
  @Post('users/:id/reactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reactivate a suspended staff account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: StatusChangeDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  reactivate(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(statusChangeSchema)) body: { reason: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.users.setStatus(params.id, 'active', body.reason, actor, this.context(request));
  }

  // --- Roles and permissions ----------------------------------------------

  @RequirePermission('role.read')
  @Get('roles')
  @ApiOperation({ summary: 'List roles with their permission and user counts' })
  listRoles() {
    return this.roles.listRoles();
  }

  @RequirePermission('role.read')
  @Get('roles/:key')
  @ApiOperation({ summary: 'One role and every permission it grants' })
  @ApiParam({ name: 'key', example: 'FINANCE_MANAGER' })
  @ApiResponse({ status: 404, description: 'No such role' })
  async getRole(@Param('key') key: string) {
    const role = await this.roles.getRole(key);
    if (!role) throw new NotFoundException('Role');
    return role;
  }

  @RequirePermission('role.read')
  @Get('permissions')
  @ApiOperation({
    summary: 'The permission catalogue',
    description:
      'The same list the API enforces. The admin UI builds its permissions matrix from this, so a screen cannot promise access the server refuses.',
  })
  listPermissions() {
    return this.roles.listPermissions();
  }
}
