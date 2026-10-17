import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// One row per project per day: the leads and ad spend entered on the
// Project Target page. The dashboard sums these for the selected month
// (Total Lead, Ads Spend, CPR, Conversion Rate).
@Entity('project_daily_metrics')
@Index(['projectId', 'date'], { unique: true })
export class ProjectDailyMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // References Project.projectId
  @Column()
  projectId: string;

  @Column('date')
  date: string; // 'YYYY-MM-DD'

  @Column('int', { default: 0 })
  leads: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  adSpend: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
