import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
    // 1. Fetch OLD order state. 
    // We MUST have these relations to know what to "refund" to the stock.
    const order = await this.ordersRepository.findOne({ 
      where: { orderId: id },
      relations: ['orderPackages', 'orderPackages.orderProducts', 'customer'] 
    });

    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // --- STEP A: THE "REFUND" ---
      // Return all items from the OLD version of the order back to the database.
      if (order.orderPackages) {
        for (const oldPkg of order.orderPackages) {
          if (oldPkg.orderProducts) {
            for (const oldItem of oldPkg.orderProducts) {
              await queryRunner.manager.increment(
                Product, 
                { productId: oldItem.productId }, 
                "quantity", 
                Number(oldItem.quantity)
              );
            }
          }
        }
      }

      // --- STEP B: CLEAR OLD CHILD RECORDS ---
      // We wipe the packages and products associated with this ID.
      await queryRunner.manager.delete(OrderPackage, { order: { orderId: id } });

      // --- STEP C: PROCESS NEW DATA (from your CreateOrderDto) ---
      const processedPackages = updateOrderDto.orderPackages?.map((pkg, pIdx) => {
        const pkgId = `OPKG-${id}-${Date.now()}-${pIdx}`;
        return {
          ...pkg,
          orderPackageId: pkgId,
          orderProducts: pkg.orderProducts?.map((prod, prIdx) => ({
            ...prod,
            productId: prod.productId,
            orderProductId: `OPRD-${id}-${pIdx}-${prIdx}-${Date.now()}`
          }))
        };
      });

      // --- STEP D: THE "DEDUCTION" ---
      // Now we deduct the stock based on the NEW data in the DTO.
      if (processedPackages) {
        for (const newPkg of processedPackages) {
          if (newPkg.orderProducts) {
            for (const newItem of newPkg.orderProducts) {
              const product = await queryRunner.manager.findOne(Product, {
                where: { productId: newItem.productId },
                lock: { mode: 'pessimistic_write' }
              });

              if (!product) throw new NotFoundException(`Product ${newItem.productId} not found`);

              // Check if stock is sufficient (after the refund we just did)
              if (product.quantity < newItem.quantity) {
                throw new BadRequestException(
                  `Insufficient stock for ${product.productName}. Available: ${product.quantity}`
                );
              }

              product.quantity -= Number(newItem.quantity);
              await queryRunner.manager.save(Product, product);
            }
          }
        }
      }

      // --- STEP E: ADJUST CUSTOMER TOTAL ---
      const oldAmount = Number(order.totalAmount || 0);
      const newAmount = Number(updateOrderDto.totalAmount || 0);
    
      if (oldAmount !== newAmount && order.customer) {
        const difference = newAmount - oldAmount;
        order.customer.totalSpent = Number(order.customer.totalSpent) + difference;
      
        // Re-evaluate VIP levels
        if (order.customer.totalSpent > 10000) order.customer.privilege = 'VVIP';
        else if (order.customer.totalSpent > 5000) order.customer.privilege = 'VIP';
        else order.customer.privilege = 'Premium';

        await queryRunner.manager.save(Customer, order.customer);
      }

      // --- STEP F: MERGE & SAVE ---
      const updatedOrder = this.ordersRepository.merge(order, {
        ...updateOrderDto,
        orderPackages: processedPackages,
      });

      const result = await queryRunner.manager.save(Order, updatedOrder);

      await queryRunner.commitTransaction();
      return result;

    } catch (err) {
      // If anything (stock check, db error) fails, the "refund" is undone.
      await queryRunner.rollbackTransaction();
      console.error("Order Update Failed:", err);
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