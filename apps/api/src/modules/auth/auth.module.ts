import { Global, Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { TotpService } from './totp.service.js';

/**
 * Auth module.
 *
 * Global because the request guard needs `AuthService` on every route, and
 * threading it through each feature module's imports would be noise.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, TotpService],
  exports: [AuthService, PasswordService, TokenService, TotpService],
})
export class AuthModule {}
