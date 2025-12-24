import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { BulkDeleteUserDto, CreateEmployeeDto, GetUsersDto, UpdateUserDto } from './dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@ApiTags('User')
@ApiBearerAuth('JWT-auth')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(@Query() query: GetUsersDto) {
    return await this.userService.findAll(query);
  }

  @Get('dropdown-options')
  async getDropdownOptions() {
    const data = await this.userService.getDropdownOptions();
    return { success: true, data };
  }

  @Get('next-employee-id')
  async getNextEmployeeId() {
    const data = await this.userService.getNextEmployeeId();
    return { success: true, data };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.userService.findOneOrFail({ where: { id } }, true);
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profilePicture', maxCount: 1 },
      { name: 'esicDoc', maxCount: 1 },
      { name: 'aadharDoc', maxCount: 1 },
      { name: 'panDoc', maxCount: 1 },
      { name: 'dlDoc', maxCount: 1 },
      { name: 'uanDoc', maxCount: 1 },
      { name: 'passportDoc', maxCount: 1 },
      { name: 'degreeDoc', maxCount: 1 },
      { name: 'offerLetterDoc', maxCount: 1 },
      { name: 'experienceLetterDoc', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Create employee with details and documents. Password is auto-generated.',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
        contactNumber: { type: 'string', example: '+919876543210' },
        roles: {
          type: 'array',
          items: { type: 'string' },
          example: ['EMPLOYEE'],
          description: 'One or more role names',
        },
        employeeId: {
          type: 'string',
          example: 'EE-0001',
          description: 'Employee ID (format: EE-0000). Auto-generated if not provided.',
        },
        fatherName: { type: 'string', example: 'Robert Doe' },
        emergencyContactNumber: { type: 'string', example: '+919876543211' },
        gender: { type: 'string', example: 'MALE' },
        dateOfBirth: { type: 'string', format: 'date', example: '1990-05-15' },
        bloodGroup: { type: 'string', example: 'O+' },
        houseNumber: { type: 'string', example: '42-A' },
        streetName: { type: 'string', example: 'Baker Street' },
        landmark: { type: 'string', example: 'Near Central Park' },
        city: { type: 'string', example: 'Mumbai' },
        state: { type: 'string', example: 'Maharashtra' },
        pincode: { type: 'string', example: '400001' },
        dateOfJoining: { type: 'string', format: 'date', example: '2024-01-15' },
        previousExperience: { type: 'string', example: '3 years' },
        employeeType: { type: 'string', example: 'PERMANENT' },
        designation: { type: 'string', example: 'DEVELOPER' },
        degree: { type: 'string', example: 'B.TECH' },
        branch: { type: 'string', example: 'COMPUTER_SCIENCE' },
        passoutYear: { type: 'integer', example: 2020 },
        bankHolderName: { type: 'string', example: 'John Doe' },
        accountNumber: { type: 'string', example: '123456789012' },
        bankName: { type: 'string', example: 'State Bank of India' },
        ifscCode: { type: 'string', example: 'SBIN0001234' },
        esicNumber: { type: 'string', example: '12345678901234567' },
        aadharNumber: { type: 'string', example: '123456789012' },
        panNumber: { type: 'string', example: 'ABCDE1234F' },
        dlNumber: { type: 'string', example: 'MH01-2020-1234567' },
        uanNumber: { type: 'string', example: '123456789012' },
        passportNumber: { type: 'string', example: 'A1234567' },
        profilePicture: { type: 'string', format: 'binary' },
        esicDoc: { type: 'string', format: 'binary' },
        aadharDoc: { type: 'string', format: 'binary' },
        panDoc: { type: 'string', format: 'binary' },
        dlDoc: { type: 'string', format: 'binary' },
        uanDoc: { type: 'string', format: 'binary' },
        passportDoc: { type: 'string', format: 'binary' },
        degreeDoc: { type: 'string', format: 'binary' },
        offerLetterDoc: { type: 'string', format: 'binary' },
        experienceLetterDoc: { type: 'string', format: 'binary' },
      },
      required: ['firstName', 'lastName', 'email', 'contactNumber', 'roles'],
    },
  })
  async createEmployee(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @Request() req: any,
    @UploadedFiles()
    files?: {
      profilePicture?: Express.Multer.File[];
      esicDoc?: Express.Multer.File[];
      aadharDoc?: Express.Multer.File[];
      panDoc?: Express.Multer.File[];
      dlDoc?: Express.Multer.File[];
      uanDoc?: Express.Multer.File[];
      passportDoc?: Express.Multer.File[];
      degreeDoc?: Express.Multer.File[];
      offerLetterDoc?: Express.Multer.File[];
      experienceLetterDoc?: Express.Multer.File[];
    },
  ) {
    const createdBy = req?.user?.id;
    return await this.userService.createEmployee(createEmployeeDto, files, createdBy);
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profilePicture', maxCount: 1 },
      { name: 'esicDoc', maxCount: 1 },
      { name: 'aadharDoc', maxCount: 1 },
      { name: 'panDoc', maxCount: 1 },
      { name: 'dlDoc', maxCount: 1 },
      { name: 'uanDoc', maxCount: 1 },
      { name: 'passportDoc', maxCount: 1 },
      { name: 'degreeDoc', maxCount: 1 },
      { name: 'offerLetterDoc', maxCount: 1 },
      { name: 'experienceLetterDoc', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Update employee with details and documents',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        contactNumber: { type: 'string', example: '+919876543210' },
        fatherName: { type: 'string', example: 'Robert Doe' },
        emergencyContactNumber: { type: 'string', example: '+919876543211' },
        gender: { type: 'string', example: 'MALE' },
        dateOfBirth: { type: 'string', format: 'date', example: '1990-05-15' },
        bloodGroup: { type: 'string', example: 'O+' },
        houseNumber: { type: 'string', example: '42-A' },
        streetName: { type: 'string', example: 'Baker Street' },
        landmark: { type: 'string', example: 'Near Central Park' },
        city: { type: 'string', example: 'Mumbai' },
        state: { type: 'string', example: 'Maharashtra' },
        pincode: { type: 'string', example: '400001' },
        dateOfJoining: { type: 'string', format: 'date', example: '2024-01-15' },
        previousExperience: { type: 'string', example: '3 years' },
        employeeType: { type: 'string', example: 'PERMANENT' },
        designation: { type: 'string', example: 'DEVELOPER' },
        degree: { type: 'string', example: 'B.TECH' },
        branch: { type: 'string', example: 'COMPUTER_SCIENCE' },
        passoutYear: { type: 'integer', example: 2020 },
        bankHolderName: { type: 'string', example: 'John Doe' },
        accountNumber: { type: 'string', example: '123456789012' },
        bankName: { type: 'string', example: 'State Bank of India' },
        ifscCode: { type: 'string', example: 'SBIN0001234' },
        esicNumber: { type: 'string', example: '12345678901234567' },
        aadharNumber: { type: 'string', example: '123456789012' },
        panNumber: { type: 'string', example: 'ABCDE1234F' },
        dlNumber: { type: 'string', example: 'MH01-2020-1234567' },
        uanNumber: { type: 'string', example: '123456789012' },
        passportNumber: { type: 'string', example: 'A1234567' },
        status: { type: 'string', example: 'ACTIVE' },
        profilePicture: { type: 'string', format: 'binary' },
        esicDoc: { type: 'string', format: 'binary' },
        aadharDoc: { type: 'string', format: 'binary' },
        panDoc: { type: 'string', format: 'binary' },
        dlDoc: { type: 'string', format: 'binary' },
        uanDoc: { type: 'string', format: 'binary' },
        passportDoc: { type: 'string', format: 'binary' },
        degreeDoc: { type: 'string', format: 'binary' },
        offerLetterDoc: { type: 'string', format: 'binary' },
        experienceLetterDoc: { type: 'string', format: 'binary' },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updatedUser: UpdateUserDto,
    @UploadedFiles()
    files?: {
      profilePicture?: Express.Multer.File[];
      esicDoc?: Express.Multer.File[];
      aadharDoc?: Express.Multer.File[];
      panDoc?: Express.Multer.File[];
      dlDoc?: Express.Multer.File[];
      uanDoc?: Express.Multer.File[];
      passportDoc?: Express.Multer.File[];
      degreeDoc?: Express.Multer.File[];
      offerLetterDoc?: Express.Multer.File[];
      experienceLetterDoc?: Express.Multer.File[];
    },
  ) {
    const updatedBy = req?.user?.id;
    return await this.userService.updateEmployee(id, updatedUser, files, updatedBy);
  }

  @Delete()
  @ApiBody({ type: BulkDeleteUserDto })
  async bulkDelete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Body() bulkDeleteDto: BulkDeleteUserDto,
  ) {
    return await this.userService.bulkDelete({
      ...bulkDeleteDto,
      deletedBy,
    });
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() { user: { id: deletedBy } }: any) {
    return await this.userService.delete(id, deletedBy);
  }
}
