import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember } from './project-member.entity';
import { CreateProjectMemberDto } from './dto/create-project-member.dto';
import { User } from '../users/user.entity';
import { Project } from '../projects/project.entity'; // ⚠️ adjust path if different

@Injectable()
export class ProjectMemberService {
  constructor(
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
  ) {}

  private flatten(record: ProjectMember) {
    return {
      projectId: record.projectId,
      userId: record.userId,
      projectName: record.project?.projectName,
      memberName: record.user?.name,
      memberEmail: record.user?.email,
      memberRole: record.user?.role,
    };
  }

  async findAll() {
    const records = await this.memberRepo.find();
    return records.map((r) => this.flatten(r));
  }

  // Powers the "Member" dropdown in the Assign/Edit modal
  async getMembers() {
    return this.userRepo.find({
      select: ['userId', 'name', 'email', 'role'],
    });
  }

  // Powers the "Project" dropdown in the Assign/Edit modal
  async getProjects() {
    return this.projectRepo.find({
      select: ['projectId', 'projectName'],
    });
  }

  async create(dto: CreateProjectMemberDto) {
    const existing = await this.memberRepo.findOne({
      where: { projectId: dto.projectId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('This member is already assigned to this project.');
    }

    const member = this.memberRepo.create(dto);
    await this.memberRepo.save(member);

    const full = await this.memberRepo.findOne({
      where: { projectId: dto.projectId, userId: dto.userId },
    });

    return this.flatten(full);
  }

  async update(oldProjectId: string, oldUserId: string, dto: CreateProjectMemberDto) {
    const existing = await this.memberRepo.findOne({
      where: { projectId: oldProjectId, userId: oldUserId },
    });
    if (!existing) {
      throw new NotFoundException('Assignment not found.');
    }

    // projectId + userId form the composite primary key, so a "move" is
    // effectively a delete-then-recreate rather than an in-place update.
    if (oldProjectId !== dto.projectId || oldUserId !== dto.userId) {
      const duplicate = await this.memberRepo.findOne({
        where: { projectId: dto.projectId, userId: dto.userId },
      });
      if (duplicate) {
        throw new ConflictException('This member is already assigned to this project.');
      }
    }

    await this.memberRepo.delete({ projectId: oldProjectId, userId: oldUserId });
    return this.create(dto);
  }

  async remove(projectId: string, userId: string) {
    const result = await this.memberRepo.delete({ projectId, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Assignment not found.');
    }
  }
}