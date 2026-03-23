import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './order.entity';
import { OrderPackage } from './order-package.entity';
import { OrderProduct } from './order-product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { Customer } from '../customer/customer.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    
    @InjectRepository(OrderPackage)
    private readonly packageRepository: Repository<OrderPackage>,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,

    private dataSource: DataSource, 
  ) {}

  /**
   * CREATE ORDER
   * Logic: Finds customer, saves order (with nested packages/products), 
   * and updates customer's lastOrderDate and totalSpent.
   */
  async create(createOrderDto: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find the customer USING THE QUERY RUNNER (ensures transaction safety)
      const customer = await queryRunner.manager.findOneBy(Customer, { 
        customerId: createOrderDto.customerId 
      });

      if (!customer) {
        throw new NotFoundException(`Customer ${createOrderDto.customerId} not found`);
      }

      // 2. Generate Custom Order ID (ORDxxx)
      const lastOrder = await queryRunner.manager.find(Order, {
        order: { orderId: 'DESC' },
        take: 1,
      });

      let newOrderId = 'ORD001';
      if (lastOrder.length > 0) {
        const lastId = lastOrder[0].orderId;
        const numberPart = parseInt(lastId.substring(3));
        newOrderId = `ORD${(numberPart + 1).toString().padStart(3, '0')}`;
      }

      // 3. Prepare Order Data
      // 🚨 CRITICAL FIX: Extract 'isNew' and empty 'orderProducts' so they don't break TypeORM
      const { customerId, isNew, orderProducts, ...orderData } = createOrderDto;
      
      // --- NEW: Generate Custom IDs for nested Packages and Products ---
      if (orderData.orderPackages && orderData.orderPackages.length > 0) {
        orderData.orderPackages = orderData.orderPackages.map((pkg, pIdx) => {
          return {
            ...pkg,
            // Generate ID: e.g., OPKG-ORD007-1710000000-0
            orderPackageId: `OPKG-${newOrderId}-${Date.now()}-${pIdx}`,
            
            // If orderProducts also use custom string IDs, do them here too!
            orderProducts: pkg.orderProducts?.map((prod, prIdx) => ({
              ...prod,
              orderProductId: `OPRD-${newOrderId}-${pIdx}-${prIdx}-${Date.now()}`
            })) || []
          };
        });
      }
      
      // 4. Create the entity instance
      const newOrder = queryRunner.manager.create(Order, {
        ...orderData,
        orderId: newOrderId, 
        customer: customer,
        // Ensure numeric values are forced to Numbers
        shippingFee: Number(orderData.shippingFee || 0),
        totalAmount: Number(orderData.totalAmount || 0),
      });

      // 5. Save Order within transaction
      const savedOrder = await queryRunner.manager.save(Order, newOrder);

      // 6. Update Customer's statistics
      const currentTotalSpent = Number(customer.totalSpent) || 0;
      const orderAmount = Number(orderData.totalAmount) || 0;
    
      // Convert the string date to a proper Date object
      customer.lastOrderDate = new Date(orderData.orderDate); 
      customer.totalSpent = currentTotalSpent + orderAmount;

      // Recalculate Privilege
      if (customer.totalSpent > 10000) customer.privilege = 'VVIP';
      else if (customer.totalSpent > 5000) customer.privilege = 'VIP';
      else customer.privilege = 'Premium';

      // 6. Save Customer within transaction
      await queryRunner.manager.save(Customer, customer);

      await queryRunner.commitTransaction();
      return savedOrder;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error("Order Creation Failed:", err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * UPDATE ORDER
   * Logic: Deletes old child records (packages/products) and replaces them 
   * with new ones to ensure clean data state.
   */
  async update(id: string, updateOrderDto: CreateOrderDto) {
    const order = await this.ordersRepository.findOne({ 
      where: { orderId: id },
      relations: ['orderPackages', 'orderPackages.orderProducts'] 
    });

    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Clear existing child records
      if (order.orderPackages && order.orderPackages.length > 0) {
        await queryRunner.manager.delete(OrderPackage, { order: { orderId: id } });
      }

      // 2. Process new packages with fresh IDs
      const processedPackages = updateOrderDto.orderPackages?.map((pkg, pIdx) => {
        const pkgId = `OPKG-${id}-${Date.now()}-${pIdx}`;
        return {
          ...pkg,
          orderPackageId: pkgId,
          orderProducts: pkg.orderProducts?.map((prod, prIdx) => ({
            ...prod,
            orderProductId: `OPRD-${id}-${pIdx}-${prIdx}-${Date.now()}`
          }))
        };
      });

      // 3. Merge and Save
      const updatedOrder = this.ordersRepository.merge(order, {
        ...updateOrderDto,
        orderPackages: processedPackages,
      });

      const result = await queryRunner.manager.save(Order, updatedOrder);

      await queryRunner.commitTransaction();
      return result;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(id: string, status: string) {
    const order = await this.ordersRepository.findOne({ where: { orderId: id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    
    order.status = status as any; 
    return await this.ordersRepository.save(order);
  }

  async findAll() {
    return await this.ordersRepository.find({
      relations: ['orderPackages', 'orderPackages.orderProducts'], 
      order: { orderDate: 'DESC' },
    });
  }

  async findOne(id: string) {
    const order = await this.ordersRepository.findOne({
      where: { orderId: id },
      relations: ['orderPackages', 'orderPackages.orderProducts'],
    });

    if (!order) throw new NotFoundException(`Order #${id} not found`);
    return order;
  }

  async remove(id: string) {
    const order = await this.ordersRepository.findOne({ where: { orderId: id } });
    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);

    await this.ordersRepository.delete({ orderId: id });
    return { message: `Order ${id} deleted successfully.` };
  }

  async getNextOrderId(): Promise<string> {
    const lastOrder = await this.ordersRepository.find({
      order: { orderId: 'DESC' },
      take: 1,
    });

    if (lastOrder.length === 0) return 'ORD001';

    const lastId = lastOrder[0].orderId; // e.g., "ORD005"
    const numberPart = parseInt(lastId.substring(3)); // 5
    const nextNumber = numberPart + 1;
    return `ORD${nextNumber.toString().padStart(3, '0')}`;
  }
}