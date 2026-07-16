import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async findAll(user: { userId: string; role: string }): Promise<Project[]> {
    // 👑 1. Master Admin bypasses restrictions and sees ALL projects
    if (user.role === 'master') {
      return this.projectRepo.find({
        relations: ['products', 'packages'],
        order: { projectName: 'ASC' },
      });
    }

    // 🔒 2. Regular staff members only see projects assigned to them in 'project_members'
    return this.projectRepo.find({
      where: {
        members: {
          userId: user.userId, // TypeORM handles the junction table join implicitly
        },
      },
      relations: ['products', 'packages'], // Keeps your existing product/package relations intact!
      order: { projectName: 'ASC' },
    });
  }

  // Generate next project ID (PRJ001 → PRJ002)
  async generateNextProjectId(): Promise<string> {
    const latest = await this.projectRepo.find({
      order: { projectId: 'DESC' }, 
      take: 1,
      withDeleted: true, 
    });

    if (!latest.length) return 'PRJ001';

    const lastId = latest[0].projectId; 
  
    // \D matches any character that is NOT a digit. 
    // This makes it prefix-independent!
    const num = parseInt(lastId.replace(/\D/g, ''), 10) || 0;
  
    return `PRJ${String(num + 1).padStart(3, '0')}`;
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { projectId: id },
      relations: ['products', 'packages'],
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(data: Partial<Project>): Promise<Project> {
    const newProject = this.projectRepo.create(data);
    return this.projectRepo.save(newProject);
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, data);
    return this.projectRepo.save(project);
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    await this.projectRepo.remove(project);
  }

  async findByName(projectName: string): Promise<Project> {
    const clean = projectName.trim();

    const project = await this.projectRepo.findOne({
        where: { projectName: clean },
        relations: ['products', 'packages'],
    });

    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
