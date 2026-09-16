import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTarget } from './project-target.entity';
import { ProjectTargetService } from './project-target.service';
import { ProjectTargetController } from './project-target.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectTarget])],
  controllers: [ProjectTargetController],
  providers: [ProjectTargetService],
})
export class ProjectTargetModule {}