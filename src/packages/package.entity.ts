import { 
  Entity, 
  PrimaryColumn, 
  Column, 
  OneToMany, 
  ManyToOne,   // <--- Ensure this is imported
  JoinColumn,  // <--- Ensure this is imported
  CreateDateColumn, 
  UpdateDateColumn, 
  DeleteDateColumn 
} from 'typeorm';
import { PackageProduct } from './package-product.entity';
import { Project } from '../projects/project.entity'; // 👈 ERROR FIXED: Added Missing Import

// Helper to convert DB strings to JS numbers
class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity()
export class Package {
  @PrimaryColumn({ length: 50 })
  packageId: string; 

  // Removed projectId string column (handled by relation below)

  @Column({ length: 255 })
  packageName: string;

  // 👇 ADDED TRANSFORMER to all decimal columns so they work as numbers
  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  sellingPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  average: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  costMargin: number;

  // --- Relationships ---
  
  @OneToMany(() => PackageProduct, (packageProduct) => packageProduct.package, {
    cascade: true, 
    eager: false   
  })
  packageProducts: PackageProduct[];

  @ManyToOne(() => Project, (project) => project.packages, {
    onDelete: 'CASCADE' 
  })
  @JoinColumn({ name: 'projectId' }) 
  project: Project;

  // --- Timestamps ---

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}