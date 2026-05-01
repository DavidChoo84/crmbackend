import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Order } from './order.entity';
import { OrderPackage } from './order-package.entity';
import { OrderProduct } from './order-product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { Customer } from '../customer/customer.entity';
import { Product } from '../products/product.entity';

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
      
      // --- STEP 5.5: DEDUCT STOCK FROM PRODUCTS ---
      // We loop through packages, then through products inside those packages
      if (orderData.orderPackages) {
        for (const pkg of orderData.orderPackages) {
          if (pkg.orderProducts) {
            for (const orderItem of pkg.orderProducts) {
              // Find the actual Product in the database
              const product = await queryRunner.manager.findOne(Product, {
                where: { productId: orderItem.productId },
                lock: { mode: 'pessimistic_write' } // Prevents other transactions from changing stock during this read/write
              });

              if (!product) {
                throw new NotFoundException(`Product ${orderItem.productId} not found`);
              }

              // Check if we have enough stock
              if (product.quantity < orderItem.quantity) {
                throw new BadRequestException(
                  `Insufficient stock for product: ${product.productName}. Available: ${product.quantity}, Requested: ${orderItem.quantity}`
                );
              }

              // Deduct the stock
              product.quantity -= Number(orderItem.quantity);

              // Save the updated product within the transaction
              await queryRunner.manager.save(Product, product);
            }
          }
        }
      }

      // 6. Update Customer's statistics
      const currentTotalSpent = Number(customer.totalSpent) || 0;
      const orderAmount = Number(orderData.totalAmount) || 0;
      
      // --- ADDED: Safely get the current total orders ---
      const currentTotalOrder = Number(customer.totalOrder) || 0; 
    
      // Convert the string date to a proper Date object
      customer.lastOrderDate = new Date(orderData.orderDate); 
      customer.totalSpent = currentTotalSpent + orderAmount;
      
      // --- ADDED: Increment total orders by 1 ---
      customer.totalOrder = currentTotalOrder + 1; 

      // Recalculate Privilege
      if (customer.totalSpent > 10000) customer.privilege = 'VVIP';
      else if (customer.totalSpent > 5000) customer.privilege = 'VIP';
      else customer.privilege = 'Premium';

      // 7. Save Customer within transaction
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
        // --- STEP A: RESTORE STOCK ---
        if (order.orderPackages) {
          for (const oldPkg of order.orderPackages) {
            const pkgMultiplier = Number(oldPkg.quantity || 1); 
            for (const oldItem of oldPkg.orderProducts || []) {
              await queryRunner.manager.increment(
                Product, 
                { productId: oldItem.productId }, 
                "quantity", 
                Number(oldItem.quantity) * pkgMultiplier
              );
            }
          }
        }

        // --- STEP B: DELETE FROM DB AND CLEAR MEMORY ---
        const oldPackageIds = order.orderPackages?.map(p => p.orderPackageId) || [];
        if (oldPackageIds.length > 0) {
          // Delete from database
          await queryRunner.manager.delete(OrderProduct, { orderPackage: { orderPackageId: In(oldPackageIds) } });
          await queryRunner.manager.delete(OrderPackage, { order: { orderId: id } });
        }
        
        /** 
         * CRITICAL FIX: Empty the array on the JS object.
         * If we don't do this, the 'merge' later will keep the old 
         * references and save them again as duplicates.
         */
        order.orderPackages = []; 

        // --- STEP C: PROCESS NEW DATA ---
        const processedPackages = updateOrderDto.orderPackages?.map((pkg, pIdx) => {
          const timestamp = Date.now();
          const pkgId = `OPKG-${id}-${timestamp}-${pIdx}`;
          return {
            ...pkg,
            orderPackageId: pkgId,
            order: { orderId: id }, 
            orderProducts: pkg.orderProducts?.map((prod, prIdx) => ({
              ...prod,
              orderProductId: `OPRD-${id}-${pIdx}-${prIdx}-${timestamp}`
            }))
          };
        });

        // --- STEP D: DEDUCT NEW STOCK ---
        if (processedPackages) {
          for (const newPkg of processedPackages) {
            const pkgMultiplier = Number(newPkg.quantity || 1);
            for (const newItem of newPkg.orderProducts || []) {
              const product = await queryRunner.manager.findOne(Product, {
                where: { productId: newItem.productId },
                lock: { mode: 'pessimistic_write' }
              });

              if (!product) throw new NotFoundException(`Product ${newItem.productId} not found`);

              const totalToDeduct = Number(newItem.quantity) * pkgMultiplier;
              if (product.quantity < totalToDeduct) {
                throw new BadRequestException(`Insufficient stock for ${product.productName}`);
              }

              product.quantity -= totalToDeduct;
              await queryRunner.manager.save(Product, product);
            }
          }
        }

        // --- STEP E: MERGE & SAVE ---
        // We merge into the now-empty order object
        const updatedOrder = this.ordersRepository.merge(order, {
          ...updateOrderDto,
          orderPackages: processedPackages,
        });

        // Avoid re-saving the customer relation if it's already there
        delete (updatedOrder as any).customer; 

        await queryRunner.manager.save(Order, updatedOrder);
        await queryRunner.commitTransaction();
        
        return this.findOne(id); 

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
    // 🚨 ADDED 'customer' to relations so we can update their stats
    const order = await this.ordersRepository.findOne({ 
      where: { orderId: id },
      relations: ['orderPackages', 'orderPackages.orderProducts', 'customer'] 
    });

    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. REFUND STOCK
      if (order.orderPackages) {
        for (const pkg of order.orderPackages) {
          const pkgMultiplier = Number(pkg.quantity || 1);
          
          for (const item of pkg.orderProducts || []) {
            await queryRunner.manager.increment(
              Product, 
              { productId: item.productId }, 
              "quantity", 
              Number(item.quantity) * pkgMultiplier
            );
          }
        }
      }

      // 2. EXPLICIT DELETE (Prevents Foreign Key Errors)
      const packageIds = order.orderPackages?.map(p => p.orderPackageId) || [];
      if (packageIds.length > 0) {
        await queryRunner.manager.delete(OrderProduct, { orderPackage: { orderPackageId: In(packageIds) } });
        await queryRunner.manager.delete(OrderPackage, { order: { orderId: id } });
      }

      // --- STEP 3: REVERSE CUSTOMER STATISTICS ---
      if (order.customer) {
        const customer = order.customer;
        const orderAmount = Number(order.totalAmount) || 0;

        // Use Math.max to prevent the numbers from ever going below 0
        customer.totalOrder = Math.max(0, (Number(customer.totalOrder) || 0) - 1);
        customer.totalSpent = Math.max(0, (Number(customer.totalSpent) || 0) - orderAmount);

        // Recalculate Privilege based on the new reduced amount
        if (customer.totalSpent > 10000) customer.privilege = 'VVIP';
        else if (customer.totalSpent > 5000) customer.privilege = 'VIP';
        else customer.privilege = 'Premium';

        // Save the updated customer
        await queryRunner.manager.save(Customer, customer);
      }

      // 4. DELETE MAIN ORDER
      await queryRunner.manager.delete(Order, { orderId: id });

      await queryRunner.commitTransaction();
      return { message: `Order ${id} deleted, inventory restored, and customer stats updated.` };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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