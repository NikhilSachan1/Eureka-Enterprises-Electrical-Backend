import { IsNotEmpty, IsString } from 'class-validator';

export class GetRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
