import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Patch, 
  Put, 
  Delete, 
  Query,
  Res,
  UseInterceptors, 
  UploadedFile 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { join } from 'path';
import { OrdersService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get('next-id')
  async getNextId() {
    const nextId = await this.ordersService.getNextOrderId();
    return { nextId };
  }

  // 🔑 NEW: optional ?projectId= query param — filters orders down to
  // those containing at least one package belonging to that project.
  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.ordersService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
  
  @Put(':id') 
  updateWithPut(@Param('id') id: string, @Body() updateOrderDto: any) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Patch(':id')
  updateWithPatch(@Param('id') id: string, @Body() updateOrderDto: any) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }
  
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
  }))
  uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    return { filePath: `uploads/${file.filename}` };
  }

  // 🔑 NEW: forces a real "Save As" download (sets Content-Disposition:
  // attachment) rather than relying on the browser to open the file inline,
  // which is unreliable for cross-origin URLs (frontend :3001, backend :3000).
  @Get('receipt/:filename')
  downloadReceipt(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), 'uploads', filename);
    return res.download(filePath);
  }
}