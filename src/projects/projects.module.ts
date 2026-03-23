import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Product } from '../products/product.entity';
import { ProductsService } from '../products/products.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Product]),
            ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProductsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
