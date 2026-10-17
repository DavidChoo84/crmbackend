import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Package } from './package.entity';
import { Product } from '../products/product.entity'; // Adjust path to where your Product entity is

@Entity('package_product')
export class PackageProduct {
  @PrimaryGeneratedColumn('uuid')
  packageProductId: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'boolean', default: false })
  isFreeItem: boolean; // true = Free Gift, false = Main Product

  // 🔑 NEW: distinguishes an add-on item from a main product. Both
  // isFreeItem and isAddOn items are excluded from the package's average
  // cost calculation — only genuine main-product cost counts toward it.
  @Column({ type: 'boolean', default: false })
  isAddOn: boolean;

  // --- Relations ---

  @ManyToOne(() => Package, (pkg) => pkg.packageProducts, { 
    onDelete: 'CASCADE', // If Package is deleted, delete these links
    orphanedRowAction: 'delete' 
  })
  @JoinColumn({ name: 'packageId' })
  package: Package;

  @ManyToOne(() => Product, { nullable: false }) 
  @JoinColumn({ name: 'productId' }) // Links to the actual Product Inventory
  product: Product;

  // --- Timestamps ---

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}