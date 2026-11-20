import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { QueryOrganisationAuditsDto } from './dto/query-organisation-audits.dto';
import { PermissionEnum } from '@/permissions/permission.registry';
import { RequirePermissions } from '@/commons/decorators/require-permissions.decorator';
import { OrganisationAuditService } from './organisation_audit.service';
import {
  type Request as ExRequest,
  type Response as ExResponse,
} from 'express';
import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import { PermissionGuard } from '@/commons/guards/permission.guard';

@ApiTags('Organisation Audits')
@Controller('api/v1/organisation-audits')
export class OrganisationAuditController {
  constructor(private readonly auditService: OrganisationAuditService) {}

  @Get()
  @RequirePermissions(PermissionEnum.AUDIT.READ)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @ApiOkResponse({
    summary:
      'Get paginated audit logs for an organisation with optional filters',
    description:
      'Get paginated audit logs for an organisation with optional filters',
    example: {
      data: {
        eventType: '',
        metadata: {},
        id: '',
        actor: {
          email: '',
          firstName: '',
          lastName: '',
        },
      },
      message: 'Audit data retrieved successfully',
      success: true,
      meta: {
        total: 10,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    },
  })
  async getAudits(
    @Query() queryDto: QueryOrganisationAuditsDto,
    @Req() request: ExRequest,
  ) {
    return await this.auditService.getAuditsForOrganisation(request, queryDto);
  }

  @Get('export/csv')
  @RequirePermissions(PermissionEnum.AUDIT.READ)
  @UseGuards(CustomJwtAuthGuard, PermissionGuard)
  @ApiOperation({
    summary:
      'Stream filtered organisation audit logs as a downloadable CSV file',
  })
  async exportAuditsCsv(
    @Query() queryDto: QueryOrganisationAuditsDto,
    @Res({ passthrough: true }) res: ExResponse,
    @Req() request: ExRequest,
  ): Promise<StreamableFile> {
    const csvStream = await this.auditService.streamAuditLogsCsv(
      request,
      queryDto,
    );

    const filename = `organisation-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(csvStream);
  }
}
