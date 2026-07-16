import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { Project } from '../projects/project.entity';

export enum UserRole {
  MASTER = 'master',
  LOGISTIC = 'logistic',
  CS_PC = 'cs_pc'
}

@Entity('users')
export class User {
  @PrimaryColumn({ length: 50 })
  userId: string;

  @Column()
  name: string;

  @Column()
  password: string; 
  
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.LOGISTIC
  })
  role: UserRole;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @Column({ unique: true })
  email: string;

  // Trackers for forgot-password lifecycle
  @Column({ name: 'reset_password_token', nullable: true })
  resetPasswordToken: string;

  @Column({ name: 'reset_password_expires', type: 'datetime', nullable: true })
  resetPasswordExpires: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToMany(() => Project, (project) => project.members)
  projects: Project[];
}