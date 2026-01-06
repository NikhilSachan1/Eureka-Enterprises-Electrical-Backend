import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { CreateFuelExpenseDto } from './create-fuel-expense.dto';

/**
 * Force Fuel Expense DTO
 * Used by admins to create fuel expense records on behalf of other users
 */
export class ForceFuelExpenseDto extends CreateFuelExpenseDto {
  @ApiProperty({
    description: 'User ID - the employee for whom the expense is being created',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
