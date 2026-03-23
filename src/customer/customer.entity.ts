import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Order } from '../order/order.entity';

@Entity()
export class Customer {
  @PrimaryColumn({ length: 255 })
  customerId: string; // Manually generated ID like "C007"

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ length: 255, nullable: true })
  mobilePhone: string;

  @Column({ type: 'int', default: 0 })
  totalOrder: number;

  @Column({ 
    type: 'decimal', 
    precision: 10, 
    scale: 2, 
    default: 0,
    // Transformer ensures the DB string converts back to a JS number for RM calculations
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  totalSpent: number;

  @Column({ length: 255, default: 'Standard' })
  privilege: string; // Defaults to Standard/Premium based on loyalty

  @Column({ type: 'timestamp', nullable: true })
  lastOrderDate: Date;

  @Column({ length: 255, nullable: true })
  fbName: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ length: 10, nullable: true })
  postCode: string;

  @Column({ length: 50, nullable: true })
  city: string;

  @Column({ length: 50, nullable: true })
  state: string;

  // Relationships
  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  // Meta tracking
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}