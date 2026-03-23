import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { OrderPackage } from './order-package.entity'; // Changed from Order

@Entity()
export class OrderProduct {
  @PrimaryColumn()
  orderProductId: string; // OPRD_001

  @Column()
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitCost: number;

  @Column({ type: 'int' })
  quantity: number;

  // --- THE FIX: Point this to OrderPackage, not Order ---
  @ManyToOne(() => OrderPackage, (orderPackage) => orderPackage.orderProducts, { 
    onDelete: 'CASCADE' 
  })
  @JoinColumn({ name: 'orderPackageId' }) // Ensure this column exists in your DB
  orderPackage: OrderPackage;

  @CreateDateColumn()
  createdAt: Date;
}