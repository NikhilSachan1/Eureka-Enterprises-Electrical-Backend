import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { PetroCardWalletService } from './petro-card-wallet.service';
import {
  CreateWalletRechargeDto,
  UpdateWalletRechargeDto,
  GetWalletRechargesDto,
  GetWalletTransactionsDto,
} from './dto';

@ApiTags('PetroCard Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('petro-card-wallet')
export class PetroCardWalletController {
  constructor(private readonly walletService: PetroCardWalletService) {}

  @Get('balance')
  @RequiredPermission('petro-card.wallet-view')
  @ApiOperation({
    summary: 'Current PetroCard wallet balance',
    description:
      'One common wallet for every PetroCard. The balance is derived — recharges minus the fuel ' +
      'entries currently holding money (petro-card, live, pending or approved) — so it can never ' +
      'drift from the entries it describes. The breakdown is returned alongside so a negative or ' +
      'surprising balance can be explained without a second call.',
  })
  async getBalance() {
    return await this.walletService.getBalance();
  }

  @Get('transactions')
  @RequiredPermission('petro-card.wallet-view')
  @ApiOperation({
    summary: 'Recharge / transaction summary',
    description:
      'Recharges and fuel deductions in one list, newest first. Recharge rows carry ' +
      '`editable: true`; fuel rows are read-only here and managed from the fuel screen.',
  })
  async getTransactions(@Query() query: GetWalletTransactionsDto) {
    return await this.walletService.getTransactions(query);
  }

  @Get('recharges')
  @RequiredPermission('petro-card.wallet-view')
  @ApiOperation({ summary: 'Recharge list — the CRUD grid' })
  async getRecharges(@Query() query: GetWalletRechargesDto) {
    return await this.walletService.getRecharges(query);
  }

  @Post('recharges')
  @RequiredPermission('petro-card.wallet-manage')
  @ApiOperation({ summary: 'Record a wallet recharge' })
  async createRecharge(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() dto: CreateWalletRechargeDto,
  ) {
    return await this.walletService.createRecharge(dto, createdBy);
  }

  @Patch('recharges/:id')
  @RequiredPermission('petro-card.wallet-manage')
  @ApiOperation({
    summary: 'Correct a wallet recharge',
    description:
      'Only the fields sent are changed. Reducing the amount can drive the balance negative when ' +
      'the money has already been spent; that is allowed, and new petro-card fuel entries are ' +
      'then refused until the wallet is topped up.',
  })
  async updateRecharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UpdateWalletRechargeDto,
  ) {
    return await this.walletService.updateRecharge(id, dto, updatedBy);
  }

  @Delete('recharges/:id')
  @RequiredPermission('petro-card.wallet-manage')
  @ApiOperation({
    summary: 'Delete a wallet recharge',
    description:
      'The balance reverses by itself — the row simply leaves the sum. Allowed even when it makes ' +
      'the balance negative.',
  })
  async deleteRecharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.walletService.deleteRecharge(id, deletedBy);
  }
}
