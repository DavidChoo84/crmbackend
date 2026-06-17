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

  // 1. FIXED: Custom ID generation handles sorting beyond C999
  async getNextId(): Promise<string> {
    const lastCustomer = await this.customerRepo
      .createQueryBuilder('customer')
      .orderBy('CAST(SUBSTRING(customer.customerId, 2) AS UNSIGNED)', 'DESC')
      .getOne();

    if (!lastCustomer) return 'C001';

    const lastId = lastCustomer.customerId;
    const numberPart = parseInt(lastId.substring(1), 10);
    const nextNumber = numberPart + 1;
    
    return `C${nextNumber.toString().padStart(3, '0')}`;
  }

  // 2. Create with New Schema Defaults
  async create(data: Partial<Customer>): Promise<Customer> {
    const newId = await this.getNextId();
    
    // Ensure totalSpent is processed cleanly as a number
    const initialSpent = Number(data.totalSpent || 0);
    const privilege = this.calculatePrivilege(initialSpent);

    const newCustomer = this.customerRepo.create({
      ...data,
      customerId: newId,
      privilege,
      totalOrder: data.totalOrder || 0,
      totalSpent: initialSpent,
    });
    return this.customerRepo.save(newCustomer);
  }

  // 3. Automatic Stats Update
  async updateStatsAfterOrder(customerId: string, orderAmount: number): Promise<void> {
    const customer = await this.customerRepo.findOneBy({ customerId });
    if (!customer) return;

    // Coerce values to numbers to prevent accidental string concatenation
    customer.totalOrder = Number(customer.totalOrder) + 1;
    customer.totalSpent = Number(customer.totalSpent) + Number(orderAmount);
    customer.lastOrderDate = new Date(); 

    // Recalculate privilege tier
    customer.privilege = this.calculatePrivilege(customer.totalSpent);

    await this.customerRepo.save(customer);
  }

  // Helper for consistent privilege logic
  private calculatePrivilege(spent: number): string {
    if (spent > 10000) return 'VVIP';
    if (spent > 5000) return 'VIP';
    return 'Premium'; 
  }

  findAll() {
    return this.customerRepo.find({
      order: { name: 'ASC' },
      take: 50
    });
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    const customer = await this.customerRepo.findOneBy({ customerId: id });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);

    // Prevent manual overwriting of lastOrderDate or primary key
    delete data.lastOrderDate;
    delete data.customerId;

    Object.assign(customer, data);

    if (data.totalSpent !== undefined) {
      customer.privilege = this.calculatePrivilege(Number(customer.totalSpent));
    }

    return await this.customerRepo.save(customer);
  }

  async softRemove(id: string): Promise<void> {
    const result = await this.customerRepo.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
  }

  // FIXED: Updated select syntax to valid TypeORM 0.3 object format
  async searchCustomers(query: string) {
    if (!query || query.length < 2) return [];

    return await this.customerRepo.find({
      where: [
        { name: Like(`%${query}%`) },
        { customerId: Like(`%${query}%`) },
        { mobilePhone: Like(`%${query}%`) }
      ],
      take: 10,
      select: {
        customerId: true,
        name: true,
        email: true,
        mobilePhone: true,
        fbName: true,
        address: true,
        postCode: true,
        city: true,
        state: true
      }
    });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOneBy({ customerId: id });
    if (!customer) throw new NotFoundException(`Customer with ID ${id} not found`);
    return customer;
  }
}