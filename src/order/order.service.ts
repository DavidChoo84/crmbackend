import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Order, OrderType } from './order.entity';
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
   */
  async create(createOrderDto: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const customer = await queryRunner.manager.findOneBy(Customer, { 
        customerId: createOrderDto.customerId 
      });

      if (!customer) {
        throw new NotFoundException(`Customer ${createOrderDto.customerId} not found`);
      }

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

      const { customerId, isNew, orderProducts, ...orderData } = createOrderDto;
      
      if (orderData.orderPackages && orderData.orderPackages.length > 0) {
        orderData.orderPackages = orderData.orderPackages.map((pkg, pIdx) => {
          return {
            ...pkg,
            orderPackageId: `OPKG-${newOrderId}-${Date.now()}-${pIdx}`,
            orderProducts: pkg.orderProducts?.map((prod, prIdx) => ({
              ...prod,
              orderProductId: `OPRD-${newOrderId}-${pIdx}-${prIdx}-${Date.now()}`
            })) || []
          };
        });
      }

      // 🔑 AUTOFILL LOGIC: Check order history inside the transaction context
      const previousOrdersCount = await queryRunner.manager.count(Order, {
        where: { customer: { customerId: customer.customerId } }
      });
      const determinedOrderType = previousOrdersCount > 0 ? OrderType.REPEAT : OrderType.NEW;
      
      const newOrder = queryRunner.manager.create(Order, {
        ...orderData,
        orderId: newOrderId, 
        customer: customer,
        orderType: determinedOrderType, // ✅ Populates your 'orderType' column automatically
        shippingFee: Number(orderData.shippingFee || 0),
        totalAmount: Number(orderData.totalAmount || 0),
      });

      const savedOrder = await queryRunner.manager.save(Order, newOrder);
      
      // 📦 INVENTORY CONTROL: Only deduct stock if order isn't created as Cancelled
      if (orderData.orderPackages && orderData.status !== 'Cancelled') {
        for (const pkg of orderData.orderPackages) {
          if (pkg.orderProducts) {
            for (const orderItem of pkg.orderProducts) {
              const product = await queryRunner.manager.findOne(Product, {
                where: { productId: orderItem.productId },
                lock: { mode: 'pessimistic_write' }
              });

              if (!product) {
                throw new NotFoundException(`Product ${orderItem.productId} not found`);
              }

              if (product.quantity < orderItem.quantity) {
                throw new BadRequestException(
                  `Insufficient stock for product: ${product.productName}. Available: ${product.quantity}, Requested: ${orderItem.quantity}`
                );
              }

              product.quantity -= Number(orderItem.quantity);
              await queryRunner.manager.save(Product, product);
            }
          }
        }
      }

      // Update Customer's statistics
      const currentTotalSpent = Number(customer.totalSpent) || 0;
      const orderAmount = Number(orderData.totalAmount) || 0;
      const currentTotalOrder = Number(customer.totalOrder) || 0; 
    
      customer.lastOrderDate = new Date(orderData.orderDate); 
      customer.totalSpent = currentTotalSpent + orderAmount;
      customer.totalOrder = currentTotalOrder + 1; 

      if (customer.totalSpent > 10000) customer.privilege = 'VVIP';
      else if (customer.totalSpent > 5000) customer.privilege = 'VIP';
      else customer.privilege = 'Premium';

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
   */
  async update(id: string, updateOrderDto: CreateOrderDto | any) {
      const order = await this.ordersRepository.findOne({ 
        where: { orderId: id },
        relations: ['customer', 'orderPackages', 'orderPackages.orderProducts'] 
      });

      if (!order) throw new NotFoundException(`Order ${id} not found`);

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const customer = await queryRunner.manager.findOneBy(Customer, { 
          customerId: updateOrderDto.customerId 
        });
        if (!customer) throw new NotFoundException(`Customer ${updateOrderDto.customerId} not found`);

        const wasCancelled = order.status === 'Cancelled';
        const isGoingToCancelled = updateOrderDto.status === 'Cancelled';

        // --- STEP A: RESTORE STOCK (Only if it wasn't already cancelled) ---
        if (order.orderPackages && !wasCancelled) {
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

        // --- STEP B: CLEAN OLD RELATION REFS ---
        const oldPackageIds = order.orderPackages?.map(p => p.orderPackageId) || [];
        if (oldPackageIds.length > 0) {
          await queryRunner.manager.delete(OrderProduct, { orderPackage: { orderPackageId: In(oldPackageIds) } });
          await queryRunner.manager.delete(OrderPackage, { order: { orderId: id } });
        }
        
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

        // --- STEP D: DEDUCT NEW STOCK (Skip completely if order is cancelled) ---
        if (processedPackages && !isGoingToCancelled) {
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
        const updatedOrder = this.ordersRepository.merge(order, {
          ...updateOrderDto,
          orderPackages: processedPackages,
        });

        updatedOrder.customer = customer;

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

  /**
   * UPDATE STATUS ALONE (From inline tables/quick actions)
   */
  async updateStatus(id: string, status: string) {
    const order = await this.ordersRepository.findOne({ 
      where: { orderId: id },
      relations: ['orderPackages', 'orderPackages.orderProducts']
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    
    const oldStatus = order.status;
    const newStatus = status;

    // Run within localized transaction block to shield concurrent balance changes
    await this.dataSource.transaction(async (transactionalEntityManager) => {
      
      // Moving to Cancelled -> Return quantities to active stock
      if (oldStatus !== 'Cancelled' && newStatus === 'Cancelled') {
        if (order.orderPackages) {
          for (const pkg of order.orderPackages) {
            const pkgMultiplier = Number(pkg.quantity || 1);
            for (const item of pkg.orderProducts || []) {
              await transactionalEntityManager.increment(
                Product,
                { productId: item.productId },
                "quantity",
                Number(item.quantity) * pkgMultiplier
              );
            }
          }
        }
      } 
      // Moving out of Cancelled back to Active -> Re-deduct warehouse stock
      else if (oldStatus === 'Cancelled' && newStatus !== 'Cancelled') {
        if (order.orderPackages) {
          for (const pkg of order.orderPackages) {
            const pkgMultiplier = Number(pkg.quantity || 1);
            for (const item of pkg.orderProducts || []) {
              const product = await transactionalEntityManager.findOne(Product, {
                where: { productId: item.productId },
                lock: { mode: 'pessimistic_write' }
              });
              if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
              
              const totalToDeduct = Number(item.quantity) * pkgMultiplier;
              if (product.quantity < totalToDeduct) {
                throw new BadRequestException(`Insufficient stock for ${product.productName} to revive order.`);
              }
              product.quantity -= totalToDeduct;
              await transactionalEntityManager.save(Product, product);
            }
          }
        }
      }

      order.status = status as any; 
      await transactionalEntityManager.save(Order, order);
    });

    return this.findOne(id);
  }

  async findAll() {
    return await this.ordersRepository.find({
      relations: ['customer', 'orderPackages', 'orderPackages.orderProducts'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const order = await this.ordersRepository.findOne({
      where: { orderId: id },
      relations: ['customer', 'orderPackages', 'orderPackages.orderProducts'],
    });

    if (!order) throw new NotFoundException(`Order #${id} not found`);
    return order;
  }

  /**
   * PERMANENT REMOVE
   */
  async remove(id: string) {
    const order = await this.ordersRepository.findOne({ 
      where: { orderId: id },
      relations: ['orderPackages', 'orderPackages.orderProducts', 'customer'] 
    });

    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. REFUND STOCK (Only if it wasn't already credited via a Cancelled state!)
      if (order.orderPackages && order.status !== 'Cancelled') {
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

      // 2. EXPLICIT RELATION PURGE
      const packageIds = order.orderPackages?.map(p => p.orderPackageId) || [];
      if (packageIds.length > 0) {
        await queryRunner.manager.delete(OrderProduct, { orderPackage: { orderPackageId: In(packageIds) } });
        await queryRunner.manager.delete(OrderPackage, { order: { orderId: id } });
      }

      // 3. REVERSE CUSTOMER STATISTICS
      if (order.customer) {
        const customer = order.customer;
        const orderAmount = Number(order.totalAmount) || 0;

        customer.totalOrder = Math.max(0, (Number(customer.totalOrder) || 0) - 1);
        customer.totalSpent = Math.max(0, (Number(customer.totalSpent) || 0) - orderAmount);

        if (customer.totalSpent > 10000) customer.privilege = 'VVIP';
        else if (customer.totalSpent > 5000) customer.privilege = 'VIP';
        else customer.privilege = 'Premium';

        await queryRunner.manager.save(Customer, customer);
      }

      // 4. DELETE MAIN ORDER
      await queryRunner.manager.delete(Order, { orderId: id });

      await queryRunner.commitTransaction();
      return { message: `Order ${id} deleted, inventory reconciled, and customer stats updated.` };

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

    const lastId = lastOrder[0].orderId;
    const numberPart = parseInt(lastId.substring(3));
    return `ORD${(numberPart + 1).toString().padStart(3, '0')}`;
  }

  async findOneOrder(orderId: string) {
    return await this.ordersRepository.findOne({
      where: { orderId },
      relations: ['customer'] 
    });
  }
}