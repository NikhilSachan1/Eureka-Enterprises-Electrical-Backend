import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverAssignmentEntity } from './entities/driver-assignment.entity';
import { DriverAssignmentService } from './driver-assignment.service';

@Module({
  imports: [TypeOrmModule.forFeature([DriverAssignmentEntity])],
  providers: [DriverAssignmentService],
  exports: [DriverAssignmentService],
})
export class DriverAssignmentModule {}
