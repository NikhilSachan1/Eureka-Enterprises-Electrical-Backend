import { Controller, Get, Post, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentAdviceService } from './payment-advice.service';
import { GetPaymentAdviceDto, SendPaymentAdviceEmailDto } from './dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';

@ApiTags('Payment Advices')
@ApiBearerAuth('JWT-auth')
@Controller('payment-advices')
export class PaymentAdviceController {
  constructor(private readonly paymentAdviceService: PaymentAdviceService) {}

  @Get()
  @RequiredPermission('financials.payment-advices.view')
  @ApiOperation({ summary: 'List payment advices with filters and pagination' })
  findAll(@Query() query: GetPaymentAdviceDto) {
    return this.paymentAdviceService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.payment-advices.view')
  @ApiOperation({ summary: 'Get a single payment advice by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentAdviceService.findById(id);
  }

  @Post(':id/email')
  @RequiredPermission('financials.payment-advices.email')
  @ApiOperation({ summary: 'Send payment advice email (manual trigger)' })
  sendEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendPaymentAdviceEmailDto,
    @GetUser('id') userId: string,
  ) {
    return this.paymentAdviceService.sendEmail(id, dto, userId);
  }

  @Delete(':id')
  @RequiredPermission('financials.payment-advices.view')
  @ApiOperation({ summary: 'Delete a payment advice' })
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.paymentAdviceService.remove(id, userId);
  }
}
