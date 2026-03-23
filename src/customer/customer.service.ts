import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Customer } from './customer.entity';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  // 1. Generate Custom ID (C001, C002...)
  async getNextId(): Promise<string> {
    const lastCustomer = await this.customerRepo.find({
      order: { customerId: 'DESC' },
      take: 1,
    });

    if (lastCustomer.length === 0) return 'C001';

    const lastId = lastCustomer[0].customerId;
    const numberPart = parseInt(lastId.substring(1));
    const nextNumber = numberPart + 1;
    
    return `C${nextNumber.toString().padStart(3, '0')}`;
  }

  // 2. Create with New Schema Defaults
  async create(data: Partial<Customer>): Promise<Customer> {
    const newId = await this.getNextId();
    
    // Auto-calculate privilege based on initial spent if provided
    const privilege = this.calculatePrivilege(data.totalSpent || 0);

    const newCustomer = this.customerRepo.create({
      ...data,
      customerId: newId,
      privilege,
      totalOrder: data.totalOrder || 0,
      totalSpent: data.totalSpent || 0,
    });
    return this.customerRepo.save(newCustomer);
  }

  // 3. Automatic Stats Update (Call this from OrderService after saving an order)
  async updateStatsAfterOrder(customerId: string, orderAmount: number): Promise<void> {
    const customer = await this.customerRepo.findOneBy({ customerId });
    if (!customer) return;

    // Update totals
    customer.totalOrder += 1;
    customer.totalSpent = Number(customer.totalSpent) + Number(orderAmount);
    customer.lastOrderDate = new Date(); // Update to current timestamp

    // Recalculate privilege tier
    customer.privilege = this.calculatePrivilege(customer.totalSpent);

    await this.customerRepo.save(customer);
  }

  // Helper for consistent privilege logic
  private calculatePrivilege(spent: number): string {
    if (spent > 10000) return 'VVIP';
    if (spent > 5000) return 'VIP';
    return 'Premium'; // Default as per your UI
  }

  findAll() {
    return this.customerRepo.find({
      order: { name: 'ASC'},
      take: 50
    });
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    const customer = await this.customerRepo.findOneBy({ customerId: id });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);

    // Prevent manual overwriting of lastOrderDate during standard updates
    delete data.lastOrderDate;

    Object.assign(customer, data);

    if (data.totalSpent !== undefined) {
        customer.privilege = this.calculatePrivilege(customer.totalSpent);
    }

    return await this.customerRepo.save(customer);
  }

  async softRemove(id: string): Promise<void> {
    const result = await this.customerRepo.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
  }

  // Updated to include fields needed for Order Modal auto-fill
  async searchCustomers(query: string) {
    if (!query || query.length < 2) return [];

    return await this.customerRepo.find({
      where: [
        { name: Like(`%${query}%`) },
        { customerId: Like(`%${query}%`) },
        { mobilePhone: Like(`%${query}%`) }
      ],
      take: 10,
      select: [
        'customerId', 'name', 'email', 'mobilePhone', 
        'fbName', 'address', 'postCode', 'city', 'state'
      ] 
    });
  }
}