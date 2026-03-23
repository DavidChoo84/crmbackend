import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';

@Entity('product')
export class Product {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  productId: string;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  // FIX: Decimals return as strings by default. 
  // Added a transformer so it actually behaves like a number in your code.
  @Column({ 
    type: 'decimal', 
    precision: 10, 
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) // Converts string from DB to number in JS
    }
  })
  costing: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 50 })
  unit: string;

  @Column({ type: 'int' })
  quantityPerBox: number;

  // FIX: Removed the @Column decorator here.
  // The @ManyToOne relationship below already creates the 'projectId' column in the DB.
  // We keep the property 'projectId' so you can access the ID directly if needed.
  @Column({ nullable: true }) 
  projectId: string; 

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  // Many Products -> One Project
  @ManyToOne(() => Project, (project) => project.products, {
    onDelete: 'CASCADE',
    eager: false, // Correct: set to true if you WANT auto-fetch
  })
  @JoinColumn({ name: 'projectId' }) // This links to the property above
  project: Project;
}