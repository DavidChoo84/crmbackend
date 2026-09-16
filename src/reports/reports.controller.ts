import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // ⚠️ adjust path if different

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // GET /reports/:projectId/summary?year=2026&month=8
  @Get(':projectId/summary')
  getSummary(
    @Param('projectId') projectId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.service.getSummary(projectId, Number(year), Number(month));
  }

  @Get(':projectId/daily')
  getDaily(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.service.getDailySales(projectId, days ? Number(days) : 30);
  }

  @Get(':projectId/weekly')
  getWeekly(@Param('projectId') projectId: string, @Query('weeks') weeks?: string) {
    return this.service.getWeeklySales(projectId, weeks ? Number(weeks) : 12);
  }

  @Get(':projectId/monthly')
  getMonthly(@Param('projectId') projectId: string, @Query('months') months?: string) {
    return this.service.getMonthlySales(projectId, months ? Number(months) : 12);
  }
}