import { Controller, Get, Post, Body, Param, Delete, Patch } from '@nestjs/common'; // 1. Import Patch
// 2. Import the Interface we created in the service
import { PackagesService, PackageInput } from './packages.service'; 
import { Package } from './package.entity';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  findAll(): Promise<Package[]> {
    return this.packagesService.findAll();
  }

  @Get('next-id')
  async getNextId() {
    return { nextId: await this.packagesService.getNextPackageId() };
  }

  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string): Promise<Package[]> {
    return this.packagesService.findByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Package> {
    return this.packagesService.findOne(id);
  }

  @Post()
  // 3. FIX: Use 'PackageInput' instead of 'Partial<Package>'
  create(@Body() data: PackageInput): Promise<Package> {
    return this.packagesService.create(data);
  }

  @Patch(':id') // 4. Recommendation: Use @Patch for updates
  // 5. FIX: Use 'PackageInput' here too
  update(@Param('id') id: string, @Body() data: PackageInput): Promise<Package> {
    return this.packagesService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    console.log('SOFT DELETE /packages/', id);
    await this.packagesService.softRemove(id);
  }
}