import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, ManyToOne } from 'typeorm';
import { OrderPackage } from './order-package.entity';
import { OrderProduct } from './order-product.entity';
import { Customer } from '../customer/customer.entity';

// Define Enums to match your DB constraints
export enum Channel {
  WHATSAPP = 'Whatsapp',
  FACEBOOK = 'Facebook', // Assuming this based on common use cases
  WEBSITE = 'Website',
  OTHER = 'Other'
}

export enum OrderType {
  NEW = 'New',
  REPEAT = 'Repeat'
}

export enum PaymentType {
  COD = 'COD',
  TNG = 'TNG', // Touch 'n Go
  TRANSFER = 'Transfer',
  CARD = 'Card'
}

export enum PaymentStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
  FAILED = 'Failed'
}

export enum OrderStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  SHIPPED = 'Shipped',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

@Entity()
export class Order {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  orderId: string;

  @Column({ type: 'datetime' })
  orderDate: Date;

  @Column({ type: 'varchar', length: 255 })
  customerName: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contactNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fbName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  postCode: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  state: string;

  @Column({ type: 'enum', enum: Channel })
  channel: Channel;

  @Column({ type: 'enum', enum: OrderType })
  orderType: OrderType;

  @Column({ type: 'enum', enum: PaymentType })
  paymentType: PaymentType;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING, nullable: true })
  paymentStatus: PaymentStatus;

  @Index() // Added index because it was marked MUL in your image
  @Column({ type: 'varchar', length: 255, nullable: true })
  salesPerson: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  courierCompany: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  trackingNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00, nullable: true })
  shippingFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Index()
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING, nullable: true })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  remark: string;

  // --- Relationships ---
  @OneToMany(() => OrderPackage, (orderPackage) => orderPackage.order, { cascade: true })
  orderPackages: OrderPackage[];

  @ManyToOne(() => Customer, (customer) => customer.orders, { onDelete: 'CASCADE' })
  customer: Customer;

  // --- Timestamps --- 
  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'datetime', precision: 6 })
  deletedAt: Date;
}