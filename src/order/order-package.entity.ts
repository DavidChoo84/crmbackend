import { Entity, PrimaryColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Order } from './order.entity';
import { OrderProduct } from './order-product.entity';

@Entity()
export class OrderPackage {
  @PrimaryColumn()
  orderPackageId: string; // OPKG_001

  @Column({ nullable: true })
  packageId: string;

  @Column()
  packageName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  packagePrice: number;

  @Column({ type: 'int' })
  quantity: number;

  // 1. This is the property the Order Entity is looking for!
  @ManyToOne(() => Order, (order) => order.orderPackages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order; 

  // 2. This allows the Package to hold Products
  @OneToMany(() => OrderProduct, (product) => product.orderPackage, { cascade: true })
  orderProducts: OrderProduct[];

  @CreateDateColumn()
  createdAt: Date;
}