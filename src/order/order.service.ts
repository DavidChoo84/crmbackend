import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
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
   * 🔑 NEW: Deducts `quantityNeeded` units of a product, transparently
   * handling sub-products. If the product has a parentProductId and its
   * own stock can't cover the request, it "opens" enough units from the
   * parent (deducting from the parent, adding unitsPerParent × boxes to
   * the sub-product) before fulfilling the sale from the sub-product.
   *
   * Regular products (no parentProductId) behave exactly as before.
   */
  private async deductProductStock(
    manager: EntityManager,
    productId: string,
    quantityNeeded: number,
  ): Promise<void> {
    const product = await manager.findOne(Product, {
      where: { productId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    // Regular product — deduct normally, same as before
    if (!product.parentProductId) {
      if (product.quantity < quantityNeeded) {
        throw new BadRequestException(
          `Insufficient stock for product: ${product.productName}. Available: ${product.quantity}, Requested: ${quantityNeeded}`,
        );
      }
      product.quantity -= quantityNeeded;
      await manager.save(Product, product);
      return;
    }

    // Sub-product — top up from parent if current stock can't cover this request.
    // The conversion ratio always mirrors the parent's own quantityPerBox —
    // there's no separate ratio stored on the sub-product itself.
    if (product.quantity < quantityNeeded) {
      const parent = await manager.findOne(Product, {
        where: { productId: product.parentProductId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!parent) {
        throw new NotFoundException(`Parent product ${product.parentProductId} not found`);
      }

      const shortfall = quantityNeeded - product.quantity;
      const unitsPerParent = parent.quantityPerBox || 1;
      const boxesNeeded = Math.ceil(shortfall / unitsPerParent);

      if (parent.quantity < boxesNeeded) {
        throw new BadRequestException(
          `Insufficient stock to open more "${product.productName}". Parent product "${parent.productName}" available: ${parent.quantity}, needed: ${boxesNeeded}`,
        );
      }

      parent.quantity -= boxesNeeded;
      product.quantity += boxesNeeded * unitsPerParent;
      await manager.save(Product, parent);
    }

    product.quantity -= quantityNeeded;
    await manager.save(Product, product);
  }

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
              await this.deductProductStock(
                queryRunner.manager,
                orderItem.productId,
                Number(orderItem.quantity),
              );
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
        // Note: restoration always credits back to the exact product that
        // was originally deducted (the sub-product itself, if applicable).
        // It intentionally does NOT try to reverse a parent "box-opening" —
        // once a box is physically opened, cancelling the order shouldn't
        // pretend it got sealed back up.
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
              const totalToDeduct = Number(newItem.quantity) * pkgMultiplier;
              await this.deductProductStock(queryRunner.manager, newItem.productId, totalToDeduct);
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
      // (same note as STEP A above: restores to the exact product deducted,
      // does not attempt to reverse a parent box-opening)
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
              const totalToDeduct = Number(item.quantity) * pkgMultiplier;
              await this.deductProductStock(transactionalEntityManager, item.productId, totalToDeduct);
            }
          }
        }
      }

      order.status = status as any; 
      await transactionalEntityManager.save(Order, order);
    });

    return this.findOne(id);
  }

  // 🔑 NEW: optional projectId filter. Orders have no direct project link —
  // it's derived via order_package.packageId -> package.projectId, same
  // join used in reports.service.ts. Raw SQL avoids depending on relation
  // property names that may not be defined on OrderPackage.
  async findAll(projectId?: string) {
    if (projectId) {
      const rows = await this.dataSource.query(
        `SELECT DISTINCT op.orderId
         FROM order_package op
         INNER JOIN package pkg ON pkg.packageId = op.packageId
         WHERE pkg.projectId = ?`,
        [projectId],
      );
      const orderIds = rows.map((r: any) => r.orderId);
      if (orderIds.length === 0) return [];

      return this.ordersRepository.find({
        where: { orderId: In(orderIds) },
        relations: ['customer', 'orderPackages', 'orderPackages.orderProducts'],
        order: { createdAt: 'DESC' },
      });
    }

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