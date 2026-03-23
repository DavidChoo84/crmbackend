import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Package } from './package.entity';
import { PackageProduct } from './package-product.entity';

// Helper Interface
export interface PackageInput {
  packageId?: string;
  projectId?: string;
  packageName?: string;
  sellingPrice?: number;
  shippingCost?: number;
  totalCost?: number;
  average?: number;
  costMargin?: number;
  packageProducts?: { 
    productId: string; 
    quantity: number; 
    isFreeItem: boolean; 
  }[];
}

@Injectable()
export class PackagesService {
  constructor(
    @InjectRepository(Package)
    private readonly packageRepo: Repository<Package>,

    @InjectRepository(PackageProduct)
    private readonly packageProductRepo: Repository<PackageProduct>,

    private dataSource: DataSource,
  ) {}

  // ... [Fetch Methods remain the same] ...
  async findAll(): Promise<Package[]> {
    return this.packageRepo.find({
      relations: ['project', 'packageProducts', 'packageProducts.product'],
      order: { packageId: 'ASC' },
      where: { deletedAt: null },
    });
  }

  async findByProject(projectId: string): Promise<Package[]> {
    return this.packageRepo.find({
      where: { project: { projectId }, deletedAt: null },
      relations: ['project', 'packageProducts', 'packageProducts.product'],
      order: { packageId: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Package> {
    const pkg = await this.packageRepo.findOne({
      where: { packageId: id, deletedAt: null },
      relations: ['project', 'packageProducts', 'packageProducts.product'],
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async getNextPackageId(): Promise<string> {
    const latest = await this.packageRepo.find({
      order: { packageId: 'DESC' },
      take: 1,
      withDeleted: true
    });
    if (!latest.length) return 'PKG001';
    const match = latest[0].packageId.match(/\d+/);
    const num = match ? parseInt(match[0], 10) + 1 : 1;
    return `PKG${num.toString().padStart(3, '0')}`;
  }

  // --- CREATE ---
  async create(data: PackageInput): Promise<Package> {
    if (!data.packageId || data.packageId.trim() === '') {
      data.packageId = await this.getNextPackageId();
    }

    return this.dataSource.transaction(async (manager) => {
      const { packageProducts, isNew, projectId, ...packageData } = data as any;
      
      // 1. Create the parent Package (WITHOUT products for now)
      const newPackage = manager.create(Package, {
        ...packageData,
        project: projectId ? { projectId: projectId } : undefined, 
      } as any);

      // 🔴 STEP 1: FORCE SAVE THE PARENT FIRST
      // This ensures 'PKG001' is inserted into the `package` table immediately.
      await manager.save(Package, newPackage);

      // 🔴 STEP 2: CREATE AND SAVE CHILDREN AFTER PARENT EXISTS
      if (packageProducts && packageProducts.length > 0) {
        const itemsToSave = packageProducts.map((item) =>
          manager.create(PackageProduct, {
            product: { productId: item.productId } as any, 
            quantity: item.quantity,
            isFreeItem: item.isFreeItem,
            // Link to the package that is already saved
            package: newPackage 
          })
        );
        
        // Explicitly save the child rows
        await manager.save(PackageProduct, itemsToSave);
      }

      // 3. Return the fully loaded package
      return await manager.findOne(Package, {
        where: { packageId: newPackage.packageId },
        relations: ['project', 'packageProducts', 'packageProducts.product'],
      });
    });
  }

  // --- UPDATE ---
  async update(id: string, data: PackageInput): Promise<Package> {
    // 1. Fetch the existing package WITH its current products
    const existingPackage = await this.packageRepo.findOne({ 
      where: { packageId: id },
      relations: ['packageProducts'] // Important: Load current items
    });

    if (!existingPackage) throw new NotFoundException(`Package ${id} not found`);

    return this.dataSource.transaction(async (manager) => {
      
      // 2. Handle PackageProducts Sync
      if (data.packageProducts) {
        
        // Map the incoming data to entities
        const incomingItems = data.packageProducts.map((item) => {
          // If the item has a packageProductId, TypeORM will UPDATE it.
          // If it doesn't, TypeORM will CREATE a new one with a new UUID.
          return manager.create(PackageProduct, {
            packageProductId: (item as any).packageProductId, // Use existing UUID if present
            product: { productId: item.productId } as any, 
            quantity: item.quantity,
            isFreeItem: item.isFreeItem,
            package: existingPackage,
          });
        });

        // Identify items that were removed from the UI and delete them
        const incomingIds = incomingItems
          .map(item => item.packageProductId)
          .filter(id => id != null);

        const itemsToRemove = existingPackage.packageProducts.filter(
          existingItem => !incomingIds.includes(existingItem.packageProductId)
        );

        if (itemsToRemove.length > 0) {
          await manager.remove(itemsToRemove);
        }

        // Update existing / Insert new
        existingPackage.packageProducts = incomingItems;
      }

      // 3. Update the main package details
      const { packageProducts, projectId, isNew, ...flatData } = data as any;
      
      if (projectId) {
        existingPackage.project = { projectId: projectId } as any;
      }

      manager.merge(Package, existingPackage, flatData);

      // 4. Save everything (TypeORM handles the inserts/updates automatically)
      return await manager.save(existingPackage);
    });
  }

  // ... [Remove Method remains the same] ...
  async softRemove(id: string): Promise<void> {
    const result = await this.packageRepo.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }
  }
}