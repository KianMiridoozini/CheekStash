import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('maintenance')
export class MaintenanceController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    @Post('recalculate-tag-counts')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Recalculate tag usage counts' })
    @ApiResponse({ status: 200, description: 'Tag usage counts recalculated successfully.' })
    @ApiResponse({ status: 500, description: 'Failed to recalculate tag usage counts.' })
    async recalculateTagCounts() {
        return this.maintenanceService.recalculateTagUsageCounts();
    }
}
