import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator.js';
import { SettingsService } from './settings.service.js';

/**
 * The organisation details the public site shows (Phase 13).
 *
 * Only the four public keys, and only rows flagged `is_public` — never
 * `fcra_enabled` or anything added later without both. The organisation's PAN
 * and registration numbers are public statutory identifiers, printed on the
 * About page.
 */
@ApiTags('public: settings')
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('public')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Organisation name, contact details, social links and registrations' })
  @ApiResponse({ status: 200, description: 'Every field present; null where not supplied' })
  read() {
    return this.settings.publicSettings();
  }
}
