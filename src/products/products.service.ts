import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // Fetch all active products (not soft-deleted)
  async findAll(): Promise<Product[]> {
    return this.productRepo.find({
      relations: ['project'], // include related project
      order: { productId: 'ASC' },
      where: { deletedAt: null },
    });
  }

  // Fetch a single product by productId
  async findOne(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { productId: id, deletedAt: null },
      relations: ['project'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findByProject(projectId: string) {
    return this.productRepo.find({
      where: {
      projectId,
      deletedAt: null,
    },
      select: ['productId', 'productName'],
      order: { productName: 'ASC' },
    });
  } 

  // Generate next product ID (PRD001 → PRD002)
  public async generateNextProductId(): Promise<string> {
    const latest = await this.productRepo.find({
      order: { productId: 'DESC' },
      take: 1,
      withDeleted: true, // include soft-deleted items
    });

    if (!latest.length) return 'PRD001';

    const lastId = latest[0].productId;
    const num = parseInt(lastId.replace(/^PRD/, ''), 10);
    return `PRD${String(num + 1).padStart(3, '0')}`;
  }

  // Create a new product with auto-generated ID
  // products.service.ts → create()
  async create(data: Partial<Product>): Promise<Product> {
    const nextId = await this.generateNextProductId(); // ignore frontend productId
    const newProduct = this.productRepo.create({
        ...data,
        productId: nextId,
    });
    return this.productRepo.save(newProduct);
  }


  // Update an existing product
  async update(id: string, data: Partial<Product>): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, data);
    return this.productRepo.save(product);
  }

  // Soft delete a product
  async softRemove(id: string): Promise<void> {
    const result = await this.productRepo.softDelete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    console.log(`✅ Product ${id} soft-deleted successfully`);
  }

  // Restore a soft-deleted product
  async restore(id: string): Promise<void> {
    const result = await this.productRepo.restore(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found or not deleted`);
    }

    console.log(`♻️ Product ${id} restored successfully`);
  }
}
