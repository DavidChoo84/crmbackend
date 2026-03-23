import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Package } from './package.entity';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { PackageProduct } from './package-product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Package, PackageProduct])],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
