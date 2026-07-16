import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, JoinTable, ManyToMany } from 'typeorm';
import { Product } from '../products/product.entity';
import { Package } from '../packages/package.entity';
import { User } from '../users/user.entity';
import { Order } from '../order/order.entity'; 

@Entity('project')
export class Project {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  projectName: string;

  @ManyToMany(() => User, (user) => user.projects)
  @JoinTable({
    name: 'project_members',
    joinColumn: { name: 'projectId', referencedColumnName: 'projectId' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'userId' },
  })
  members: User[];

  @OneToMany(() => Product, (product) => product.project, { cascade: true })
  products: Product[];

  @OneToMany(() => Package, (pkg) => pkg.project, { cascade: true })
  packages: Package[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}