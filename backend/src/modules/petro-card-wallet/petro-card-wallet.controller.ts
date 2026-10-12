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

  @Get('outstanding')
  @RequiredPermission('petro-card.wallet-view')
  @ApiOperation({
    summary: 'Outstanding wallet recharges — what the company still owes the cards',
    description:
      'Recharges that have been raised, are not paid, and are not already sitting on a live ' +
      'Payment Sheet. This is what the Payment Sheet beneficiary picker reads for a wallet line: ' +
      'the amount comes from the recharge, so a line can never ask for more than was raised. ' +
      'Returns the running total alongside the page.',
  })
  async getOutstanding(@Query() query: GetWalletRechargesDto) {
    return await this.walletService.getOutstanding(query);
  }

  @Get('recharges')
  @RequiredPermission('petro-card.wallet-view')
  @ApiOperation({ summary: 'Recharge list — the CRUD grid' })
  async getRecharges(@Query() query: GetWalletRechargesDto) {
    return await this.walletService.getRecharges(query);
  }

  @Post('recharges')
  @RequiredPermission('petro-card.wallet-manage')
  @ApiOperation({
    summary: 'Raise a wallet recharge — does not credit the wallet',
    description:
      'Records that money is to be put on the cards. The recharge lands PENDING and appears in ' +
      'the outstanding list; the balance moves only when a Payment Sheet line for it is paid. ' +
      'Payment details sent here are kept as what was intended and are overwritten at payment ' +
      'with the UTR, mode and account the money actually went out on.',
  })
  async createRecharge(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() dto: CreateWalletRechargeDto,
  ) {
    return await this.walletService.createRecharge(dto, createdBy);
  }

  @Patch('recharges/:id')
  @RequiredPermission('petro-card.wallet-manage')
  @ApiOperation({
    summary: 'Correct a wallet recharge while it is still outstanding',
    description:
      'Only the fields sent are changed. Allowed only while the recharge is PENDING and no live ' +
      'Payment Sheet is holding it — once it is on a sheet the amount must not move under the ' +
      'accountant about to pay it, and once paid it is a record of a payment and is final.',
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
    summary: 'Withdraw an outstanding wallet recharge',
    description:
      'Withdraws a request, it does not reverse money: a PENDING recharge was never in the ' +
      'balance. Allowed only while it is outstanding — refused once a live Payment Sheet is ' +
      'holding it, and once it has been paid.',
  })
  async deleteRecharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.walletService.deleteRecharge(id, deletedBy);
  }
}
