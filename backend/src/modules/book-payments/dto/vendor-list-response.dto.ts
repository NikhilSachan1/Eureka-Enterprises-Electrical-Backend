import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VendorBankDetailsDto {
  @ApiPropertyOptional() accountHolderName: string | null;
  @ApiPropertyOptional() bankName: string | null;
  @ApiPropertyOptional() accountNumber: string | null;
  @ApiPropertyOptional() ifscCode: string | null;
}

export class VendorInfoDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() city: string;
  @ApiProperty() state: string;
  @ApiProperty() contactNumber: string;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ type: () => VendorBankDetailsDto }) bankDetails: VendorBankDetailsDto;
}

export class SiteInfoDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) city: string | null;
  @ApiProperty({ nullable: true }) state: string | null;
}

export class CompanyInfoDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class InvoiceInfoDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) invoiceNumber: string | null;
  @ApiProperty({ nullable: true }) invoiceDate: string | null;
  @ApiProperty({ nullable: true }) totalAmount: number | null;
  @ApiProperty() approvalStatus: string;
}

export class JmcInfoDto {
  @ApiProperty() id: string;
  @ApiProperty() jmcNumber: string;
  @ApiProperty() jmcDate: string;
}

export class PoInfoDto {
  @ApiProperty() id: string;
  @ApiProperty() poNumber: string;
  @ApiProperty() poDate: string;
  @ApiProperty() totalAmount: number;
}

export class VendorBookPaymentItemDto {
  @ApiProperty() id: string;
  @ApiProperty() bookingDate: string;
  @ApiProperty() taxableAmount: number;
  @ApiProperty() gstAmount: number;
  @ApiProperty({ nullable: true }) gstPercentage: number | null;
  @ApiProperty({ description: 'TDS deduction amount from the invoice' }) tdsAmount: number;
  @ApiProperty({ description: 'Whether GST is held on the invoice' }) isGstHold: boolean;
  @ApiProperty({ description: 'isGstHold=true: taxable−tds; isGstHold=false: taxable+gst−tds' })
  netPayableAmount: number;
  @ApiProperty() paymentTotalAmount: number;
  @ApiProperty() paymentHoldAmount: number;
  @ApiProperty({ nullable: true }) paymentHoldReason: string | null;
  @ApiProperty({ nullable: true }) remarks: string | null;
  @ApiProperty() approvalStatus: string;
  @ApiProperty() hasTransfer: boolean;
  @ApiProperty({ description: 'vendor name | site name | company name | city | state' })
  displayName: string;
  @ApiProperty({ type: InvoiceInfoDto }) invoice: InvoiceInfoDto;
  @ApiProperty({ type: JmcInfoDto, nullable: true }) jmc: JmcInfoDto | null;
  @ApiProperty({ type: PoInfoDto, nullable: true }) po: PoInfoDto | null;
  @ApiProperty({ type: SiteInfoDto }) site: SiteInfoDto;
  @ApiProperty({ type: CompanyInfoDto }) company: CompanyInfoDto;
}

export class VendorSummaryDto {
  @ApiProperty() totalBookPayments: number;
  @ApiProperty() totalTaxableAmount: number;
  @ApiProperty() totalGstAmount: number;
  @ApiProperty() totalTdsAmount: number;
  @ApiProperty() totalNetPayableAmount: number;
  @ApiProperty() totalPaymentAmount: number;
  @ApiProperty() totalHoldAmount: number;
}

export class VendorListRecordDto {
  @ApiProperty({ type: VendorInfoDto }) vendor: VendorInfoDto;
  @ApiProperty({ type: VendorSummaryDto }) vendorSummary: VendorSummaryDto;
  @ApiProperty({ type: [VendorBookPaymentItemDto] }) bookPayments: VendorBookPaymentItemDto[];
}

export class GlobalSummaryDto {
  @ApiProperty() totalVendors: number;
  @ApiProperty() totalBookPayments: number;
  @ApiProperty() totalTaxableAmount: number;
  @ApiProperty() totalGstAmount: number;
  @ApiProperty() totalTdsAmount: number;
  @ApiProperty() totalNetPayableAmount: number;
  @ApiProperty() totalPaymentAmount: number;
  @ApiProperty() totalHoldAmount: number;
}

export class VendorListResponseDto {
  @ApiProperty({ type: [VendorListRecordDto] }) records: VendorListRecordDto[];
  @ApiProperty() totalRecords: number;
  @ApiProperty({ type: GlobalSummaryDto }) summary: GlobalSummaryDto;
}
