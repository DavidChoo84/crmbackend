import { IsString, IsNotEmpty, IsArray, ValidateNested, IsNumber, IsOptional, IsEnum, IsDate, IsDecimal } from 'class-validator';
import { Type } from 'class-transformer';
import { Channel, OrderType, PaymentType, PaymentStatus, OrderStatus } from '../order.entity';

// 1. Product remains the same
export class CreateOrderProductDto {
  @IsString()
  @IsNotEmpty()
  productId: string;
  
  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  unitCost: number;

  @IsNumber()
  quantity: number;
}

// 2. FIXED: Package must now contain the Products array
export class CreateOrderPackageDto {
  // 🔑 FIX: was missing here — with ValidationPipe({ whitelist: true }) in
  // main.ts, any field not declared on this DTO gets silently stripped
  // before it reaches the service, even though the frontend sends it and
  // the entity has a matching column.
  @IsString()
  @IsOptional()
  packageId?: string;

  @IsString()
  @IsNotEmpty()
  packageName: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  packagePrice: number;

  @IsNumber()
  quantity: number;

  @IsArray()
  @IsOptional() // Use optional if a package could theoretically be empty
  @ValidateNested({ each: true })
  @Type(() => CreateOrderProductDto)
  orderProducts: CreateOrderProductDto[];
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;
  
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  orderDate: Date;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsOptional()
  contactNumber?: string;

  @IsString()
  @IsOptional()
  fbName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date | null;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  postCode?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsEnum(Channel)
  @IsNotEmpty()
  channel: Channel;

  @IsOptional()
  @IsEnum(OrderType)
  @IsNotEmpty()
  orderType: OrderType;

  @IsEnum(PaymentType)
  @IsNotEmpty()
  paymentType: PaymentType;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsString()
  @IsOptional()
  salesPerson?: string; 

  @IsOptional()
  @IsString()
  receiptImage?: string;

  @IsString()
  @IsOptional()
  courierCompany?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  totalAmount: number;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPackageDto)
  orderPackages: CreateOrderPackageDto[];
}