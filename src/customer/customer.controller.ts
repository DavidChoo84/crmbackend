import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param,
  Query, 
  HttpCode, 
  HttpStatus 
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { Customer } from './customer.entity';

@Controller('customers') 
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}
  
  @Get('search')
  async search(@Query('q') query: string) {
    return await this.customerService.searchCustomers(query);
  }

  @Get('next-id')
  async getNextId() {
    const nextId = await this.customerService.getNextId();
    return { nextId }; // Returning an object is best practice for JSON APIs
  }
  
  // Create a new customer
  @Post()
    create(@Body() data: Partial<Customer>): Promise<Customer> {
    return this.customerService.create(data);
  }

  @Get()
  async findAll(): Promise<Customer[]> {
    return await this.customerService.findAll();
  }

  // Update a customer by custom ID (e.g., C001)
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<Customer>) {
    return await this.customerService.update(id, data);
  }

  // Soft Delete a customer by custom ID
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    console.log('SOFT DELETE /packages/', id);
    await this.customerService.softRemove(id);
  }
}