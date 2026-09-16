import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from '../projects/project.entity'; // ⚠️ adjust path if different
import { User } from '../users/user.entity';

@Entity('project_members')
export class ProjectMember {
  @PrimaryColumn()
  projectId: string;

  @PrimaryColumn()
  userId: string;

  @ManyToOne(() => Project, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}