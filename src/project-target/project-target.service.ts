import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTarget } from './project-target.entity';
import { UpsertProjectTargetDto } from './dto/upsert-project-target.dto';

@Injectable()
export class ProjectTargetService {
  constructor(
    @InjectRepository(ProjectTarget) private repo: Repository<ProjectTarget>,
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
      record.adSpend = dto.adSpend;
    } else {
      record = this.repo.create(dto);
    }

    return this.repo.save(record);
  }
}