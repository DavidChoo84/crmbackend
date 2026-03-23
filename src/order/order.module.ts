import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './order.service';
import { OrdersController } from './order.controller';
import { Order } from './order.entity';
import { OrderPackage } from './order-package.entity';
import { OrderProduct } from './order-product.entity';
import { Customer } from '../customer/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderPackage, OrderProduct, Customer])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}