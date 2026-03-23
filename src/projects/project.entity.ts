import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { Product } from '../products/product.entity';
import { Package } from '../packages/package.entity';

@Entity('project')
export class Project {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  projectName: string;

  // One Project -> Many Products
  @OneToMany(() => Product, (product) => product.project, {
    cascade: true,
  })
  products: Product[];

  // One Project -> Many Packages
  @OneToMany(() => Package, (pkg) => pkg.project, {
    cascade: true,
  })
  packages: Package[];

  // --- Add these for consistency with other tables ---
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}