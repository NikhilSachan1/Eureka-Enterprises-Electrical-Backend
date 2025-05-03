import { Module } from '@nestjs/common';
import { UtilityService } from 'src/utils/utility/utility.service';

@Module({
  providers: [UtilityService],
  exports: [UtilityService],
})
export class SharedModule {}
