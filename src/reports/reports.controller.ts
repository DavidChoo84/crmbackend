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

  // Chart endpoints take optional year/month so they follow the dashboard's
  // month filter; without them they default to the current month.
  // GET /reports/:projectId/daily?year=2026&month=8
  @Get(':projectId/daily')
  getDaily(
    @Param('projectId') projectId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.service.getDailySales(projectId, Number(year), Number(month));
  }

  @Get(':projectId/weekly')
  getWeekly(
    @Param('projectId') projectId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.service.getWeeklySales(projectId, Number(year), Number(month));
  }

  @Get(':projectId/monthly')
  getMonthly(
    @Param('projectId') projectId: string,
    @Query('months') months?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.service.getMonthlySales(projectId, months ? Number(months) : 12, Number(year), Number(month));
  }
}