import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './product.entity';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}


  // GET /products/next-id → returns next product ID
  @Get('next-id')
  async getNextId(): Promise<{ nextId: string }> {
    const nextId = await this.productsService.generateNextProductId();
    return { nextId };
  }
  
  // ✅ Get all active products
  @Get()
  getAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  // ✅ Get single product by productId
  @Get(':id')
  getOne(@Param('id') id: string): Promise<Product> {
    return this.productsService.findOne(id);
  }

  // ✅ Create new product
  @Post()
  create(@Body() data: Partial<Product>): Promise<Product> {
    return this.productsService.create(data);
  }

  // ✅ Update existing product
  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<Product>): Promise<Product> {
    return this.productsService.update(id, data);
  }

  // ✅ Soft delete product
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    console.log('SOFT DELETE /products/', id);
    await this.productsService.softRemove(id);
  }

}
