import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ProjectTarget } from './project-target.entity';
import { ProjectDailyMetric } from './project-daily-metric.entity';
import { UpsertProjectTargetDto } from './dto/upsert-project-target.dto';
import { UpsertDailyMetricsDto } from './dto/upsert-daily-metrics.dto';

@Injectable()
export class ProjectTargetService {
  constructor(
    @InjectRepository(ProjectTarget) private repo: Repository<ProjectTarget>,
    @InjectRepository(ProjectDailyMetric) private dailyRepo: Repository<ProjectDailyMetric>,
  ) {}

  async findByProject(projectId: string) {
    return this.repo.find({
      where: { projectId },
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  async findOne(projectId: string, year: number, month: number) {
    return this.repo.findOne({ where: { projectId, year, month } });
  }

  async upsert(dto: UpsertProjectTargetDto) {
    let record = await this.repo.findOne({
      where: { projectId: dto.projectId, year: dto.year, month: dto.month },
    });

    if (record) {
      record.targetOfMonth = dto.targetOfMonth;
      record.estimateSales = dto.estimateSales;
    } else {
      record = this.repo.create({
        projectId: dto.projectId,
        year: dto.year,
        month: dto.month,
        targetOfMonth: dto.targetOfMonth,
        estimateSales: dto.estimateSales,
      });
    }

    return this.repo.save(record);
  }

  // Daily leads + ad spend for one month, oldest day first.
  async findDailyMetrics(projectId: string, year: number, month: number) {
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return this.dailyRepo.find({
      where: { projectId, date: Between(`${year}-${mm}-01`, `${year}-${mm}-${lastDay}`) },
      order: { date: 'ASC' },
    });
  }

  // Saves each submitted day (one row per project + date). Blank days are
  // sent as 0, which keeps the month's totals correct after an edit.
  async upsertDailyMetrics(dto: UpsertDailyMetricsDto) {
    if (dto.days.length === 0) return [];
    const dates = dto.days.map((d) => d.date.slice(0, 10));
    const existing = await this.dailyRepo.find({
      where: dates.map((date) => ({ projectId: dto.projectId, date })),
    });
    const byDate = new Map(existing.map((r) => [String(r.date).slice(0, 10), r]));

    const records = dto.days.map((d) => {
      const date = d.date.slice(0, 10);
      const record = byDate.get(date) ?? this.dailyRepo.create({ projectId: dto.projectId, date });
      record.leads = d.leads;
      record.adSpend = d.adSpend;
      return record;
    });
    return this.dailyRepo.save(records);
  }
}
