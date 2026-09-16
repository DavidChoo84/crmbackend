import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('project_targets')
@Index(['projectId', 'year', 'month'], { unique: true })
export class ProjectTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // References Project.projectId
  @Column()
  projectId: string;

  @Column('int')
  year: number;

  @Column('int')
  month: number; // 1–12

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  targetOfMonth: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  estimateSales: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  adSpend: number;
  
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}