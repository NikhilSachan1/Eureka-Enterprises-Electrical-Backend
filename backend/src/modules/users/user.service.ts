import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from './entities/user.entity';
import { UserRepository } from './user.repository';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  USERS_ERRORS,
  USER_FIELD_NAMES,
  UserStatus,
  USERS_RESPONSES,
  VALIDATION_PATTERNS,
  USER_DTO_ERRORS,
} from './constants/user.constants';
import { UserMetrics } from './user.types';
import { DataSuccessOperationType, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { DataSource, EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  BulkDeleteUserDto,
  CreateEmployeeDto,
  CreateEmployeeWithSalaryDto,
  GetUsersDto,
  ResendPasswordLinkDto,
} from './dto';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { CONFIGURATION_KEYS } from 'src/utils/master-constants/master-constants';
import { RoleService } from '../roles/role.service';
import { UserRoleService } from '../user-roles/user-role.service';
import { FilesService } from '../common/file-upload/files.service';
import { FILE_UPLOAD_FOLDER_NAMES } from '../common/file-upload/constants/files.constants';
import { InjectDataSource } from '@nestjs/typeorm';
import { UserDocumentService } from '../user-documents/user-document.service';
import {
  USER_DOCUMENT_TYPES,
  USER_DOCUMENT_ERRORS,
} from '../user-documents/constants/user-document.constants';
import { SalaryStructureService } from '../salary-structures/salary-structure.service';
import { Environments } from 'env-configs';
import { AUTH_REDIRECT_ROUTES } from '../auth/constants/auth.constants';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private utilityService: UtilityService,
    private configurationService: ConfigurationService,
    private configSettingService: ConfigSettingService,
    private roleService: RoleService,
    private userRoleService: UserRoleService,
    private filesService: FilesService,
    private userDocumentService: UserDocumentService,
    @Inject(forwardRef(() => SalaryStructureService))
    private salaryStructureService: SalaryStructureService,
    @InjectDataSource() private dataSource: DataSource,
    private jwtService: JwtService,
  ) {}

  async findAll(
    options: GetUsersDto,
  ): Promise<{ records: UserEntity[]; totalRecords: number; metrics: UserMetrics } | undefined> {
    try {
      if (options.role && options.role.length > 0) {
        await this.validateRolesFromDb(options.role);
      }

      const [users, metrics] = await Promise.all([
        this.userRepository.findAll(options),
        this.userRepository.getMetrics(),
      ]);
      return {
        ...users,
        metrics,
      };
    } catch (error) {
      throw error;
    }
  }

  private async validateRolesFromDb(roles: string[]): Promise<void> {
    const validRolesResult = await this.roleService.findAll({});
    const validRoleNames = validRolesResult.records.map((role) => role.name.toUpperCase());

    const invalidRoles = roles.filter((role) => !validRoleNames.includes(role.toUpperCase()));

    if (invalidRoles.length > 0) {
      throw new BadRequestException(
        USER_DTO_ERRORS.INVALID_ROLE.replace('{invalidRoles}', invalidRoles.join(', ')).replace(
          '{validRoles}',
          validRoleNames.join(', '),
        ),
      );
    }
  }

  async findOne(options: FindOptionsWhere<UserEntity>) {
    try {
      const user = await this.userRepository.findOne({ where: options });
      return user;
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(options: FindOneOptions<UserEntity>, includeDocuments = false) {
    try {
      const user = await this.userRepository.findOne(options);
      if (!user) throw new NotFoundException(USERS_ERRORS.NOT_FOUND);

      if (includeDocuments) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _password, ...userWithoutPassword } = user;
        const documents = await this.getUserDocuments(user.id);

        // Fetch user roles (a user can have multiple roles)
        const userRoles = await this.userRoleService.findAll({
          where: { userId: user.id },
          relations: ['role'],
        });
        const roles = userRoles?.map((ur) => ({ name: ur.role?.name })).filter((r) => r.name) || [];

        // Fetch createdBy and updatedBy user details
        let createdByUser = null;
        let updatedByUser = null;

        if (user.createdBy) {
          const createdByData = await this.userRepository.findOne({
            where: { id: user.createdBy },
          });
          if (createdByData) {
            createdByUser = {
              id: createdByData.id,
              firstName: createdByData.firstName,
              lastName: createdByData.lastName,
              email: createdByData.email,
              employeeId: createdByData.employeeId,
            };
          }
        }

        if (user.updatedBy) {
          const updatedByData = await this.userRepository.findOne({
            where: { id: user.updatedBy },
          });
          if (updatedByData) {
            updatedByUser = {
              id: updatedByData.id,
              firstName: updatedByData.firstName,
              lastName: updatedByData.lastName,
              email: updatedByData.email,
              employeeId: updatedByData.employeeId,
            };
          }
        }

        return { ...userWithoutPassword, roles, documents, createdByUser, updatedByUser };
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  async create(
    user: Partial<UserEntity & { roleId: string; invitationId: string }>,
    entityManager?: EntityManager,
  ): Promise<UserEntity> {
    try {
      return await this.userRepository.create(user as any, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async createEmployee(
    createEmployeeDto: CreateEmployeeDto | CreateEmployeeWithSalaryDto,
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
    createdBy?: string,
  ) {
    const { email, roles, employeeId: providedEmployeeId } = createEmployeeDto;
    const salaryDetails = (createEmployeeDto as CreateEmployeeWithSalaryDto).salary;

    await this.validateDropdownFields(createEmployeeDto);

    const existingUser = await this.findOne({ email });
    if (existingUser) {
      throw new BadRequestException(USERS_RESPONSES.EMAIL_ALREADY_EXISTS);
    }

    // Validate employee ID format if provided
    if (providedEmployeeId) {
      if (!this.validateEmployeeIdFormat(providedEmployeeId)) {
        throw new BadRequestException(USERS_ERRORS.INVALID_EMPLOYEE_ID);
      }
      await this.validateEmployeeIdUniqueness(providedEmployeeId);
    }

    // Validate all roles exist
    const roleEntities = [];
    for (const roleName of roles) {
      const roleEntity = await this.roleService.findOne({ where: { name: roleName } });
      if (!roleEntity) {
        throw new NotFoundException(`${USERS_RESPONSES.ROLE_NOT_FOUND}: ${roleName}`);
      }
      roleEntities.push(roleEntity);
    }

    const generatedPassword = this.utilityService.generateSecurePassword();

    // Generate employee ID if not provided
    const employeeId = providedEmployeeId || (await this.userRepository.getNextEmployeeId());

    let uploadedFiles: Record<string, string> = {};
    if (files && Object.keys(files).length > 0) {
      uploadedFiles = await this.handleFileUploads(files, email);
    }

    return await this.dataSource.transaction(async (entityManager) => {
      try {
        // Only profilePicture goes to user table, other docs go to user_documents
        const userData: any = this.utilityService.convertEmptyStringsToNull({
          ...createEmployeeDto,
          employeeId,
          password: this.utilityService.createHash(generatedPassword),
          status: UserStatus.ACTIVE,
          createdBy,
          profilePicture: uploadedFiles.profilePicture || null,
        });

        // Remove salary from userData as it goes to separate table
        delete userData.salary;

        if (userData.dateOfBirth) {
          userData.dateOfBirth = new Date(userData.dateOfBirth);
        }
        if (userData.dateOfJoining) {
          userData.dateOfJoining = new Date(userData.dateOfJoining);
        }

        delete userData.roles;

        const user = await this.create(userData, entityManager);

        // Create user documents for identity docs (isUpdate = false for new employee)
        await this.createUserDocuments(user.id, uploadedFiles, createdBy, entityManager, false);

        // Create user roles for all assigned roles
        for (const roleEntity of roleEntities) {
          await this.userRoleService.create(
            { userId: user.id, roleId: roleEntity.id },
            entityManager,
          );
        }

        // Create salary structure if salary details provided
        // Effective from = date of joining (or today if not provided)
        if (salaryDetails) {
          const effectiveFrom = userData.dateOfJoining
            ? new Date(userData.dateOfJoining).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          await this.salaryStructureService.create(
            {
              userId: user.id,
              basic: salaryDetails.basic,
              hra: salaryDetails.hra || 0,
              foodAllowance: salaryDetails.foodAllowance || 0,
              conveyanceAllowance: salaryDetails.conveyanceAllowance || 0,
              medicalAllowance: salaryDetails.medicalAllowance || 0,
              specialAllowance: salaryDetails.specialAllowance || 0,
              employeePf: salaryDetails.employeePf || 0,
              employerPf: salaryDetails.employerPf || 0,
              tds: salaryDetails.tds || 0,
              esic: salaryDetails.esic || 0,
              professionalTax: salaryDetails.professionalTax || 0,
              effectiveFrom,
              remarks: 'Initial salary structure',
            },
            createdBy,
            entityManager,
          );
        }

        // TODO: Send welcome email with credentials to the employee
        // await this.sendWelcomeEmail(email, generatedPassword, createEmployeeDto.firstName);
        Logger.log(`TODO: Send welcome email to ${email} with generated password`);

        return {
          id: user.id,
          employeeId: user.employeeId,
          message: USERS_RESPONSES.EMPLOYEE_CREATED,
          salaryCreated: !!salaryDetails,
        };
      } catch (error) {
        Logger.error('Create employee failed:', error);
        // Cleanup uploaded files on failure
        if (Object.keys(uploadedFiles).length > 0) {
          await this.cleanupUploadedFiles(uploadedFiles);
        }
        throw error;
      }
    });
  }

  private async createUserDocuments(
    userId: string,
    uploadedFiles: Record<string, string>,
    createdBy: string,
    entityManager?: EntityManager,
    isUpdate = false,
  ): Promise<void> {
    // Mapping of file field names to document types
    // Document types must exist in configurations (document_types)
    const documentMappings = [
      { key: 'aadharDoc', type: USER_DOCUMENT_TYPES.AADHAR },
      { key: 'panDoc', type: USER_DOCUMENT_TYPES.PAN },
      { key: 'esicDoc', type: USER_DOCUMENT_TYPES.ESIC },
      { key: 'dlDoc', type: USER_DOCUMENT_TYPES.DRIVING_LICENSE },
      { key: 'uanDoc', type: USER_DOCUMENT_TYPES.UAN },
      { key: 'passportDoc', type: USER_DOCUMENT_TYPES.PASSPORT },
      { key: 'degreeDoc', type: USER_DOCUMENT_TYPES.EDUCATION_CERTIFICATE },
      { key: 'offerLetterDoc', type: USER_DOCUMENT_TYPES.OFFER_LETTER },
      { key: 'experienceLetterDoc', type: USER_DOCUMENT_TYPES.EXPERIENCE_LETTER },
    ];

    for (const { key, type } of documentMappings) {
      if (uploadedFiles[key]) {
        // Validate document type against configuration
        await this.validateDocumentType(type);

        // Delete existing documents only on update (replace, not append)
        if (isUpdate) {
          await this.userDocumentService.deleteByCondition(
            { userId, documentType: type },
            createdBy,
            entityManager,
          );
        }

        // Create new document record
        await this.userDocumentService.create(
          {
            userId,
            documentType: type,
            fileKeys: [uploadedFiles[key]],
            createdBy,
          },
          entityManager,
        );
      }
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<UserEntity>,
    updateData: Record<string, any>,
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: identifierConditions,
      });
      if (!user) throw new NotFoundException(USERS_ERRORS.NOT_FOUND);

      await this.validateDropdownFields(updateData);

      const processedData: any = this.utilityService.convertEmptyStringsToNull(updateData);
      if (processedData.dateOfBirth && typeof processedData.dateOfBirth === 'string') {
        processedData.dateOfBirth = new Date(processedData.dateOfBirth);
      }
      if (processedData.dateOfJoining && typeof processedData.dateOfJoining === 'string') {
        processedData.dateOfJoining = new Date(processedData.dateOfJoining);
      }

      await this.userRepository.update(identifierConditions, processedData);
      return this.utilityService.getSuccessMessage(
        USER_FIELD_NAMES.USER,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async updateEmployee(
    id: string,
    updateData: Record<string, any>,
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
    updatedBy?: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(USERS_ERRORS.NOT_FOUND);
    }

    // Check if email is being updated and if it's already taken by another user
    if (updateData.email && updateData.email !== user.email) {
      const existingUserWithEmail = await this.findOne({ email: updateData.email });
      if (existingUserWithEmail && existingUserWithEmail.id !== id) {
        throw new BadRequestException(USERS_RESPONSES.EMAIL_ALREADY_EXISTS);
      }
    }

    // Validate status change
    if (updateData.status) {
      if (updateData.status === UserStatus.ARCHIVED && user.status === UserStatus.ARCHIVED) {
        throw new BadRequestException(USERS_ERRORS.USER_ALREADY_ARCHIVED);
      }
      if (updateData.status === UserStatus.ACTIVE && user.status === UserStatus.ACTIVE) {
        throw new BadRequestException(USERS_ERRORS.USER_ALREADY_ACTIVE);
      }
    }

    await this.validateDropdownFields(updateData);

    let uploadedFiles: Record<string, string> = {};
    if (files && Object.keys(files).length > 0) {
      uploadedFiles = await this.handleFileUploads(files, user.email);

      // Only cleanup old profile picture from user table
      if (uploadedFiles.profilePicture && user.profilePicture) {
        this.cleanupUploadedFiles({ profilePicture: user.profilePicture }).catch((err) =>
          Logger.error('Failed to cleanup old profile picture:', err),
        );
      }
    }

    return await this.dataSource.transaction(async (entityManager) => {
      // Only profilePicture goes to user table
      const processedData: any = this.utilityService.convertEmptyStringsToNull({
        ...updateData,
        profilePicture: uploadedFiles.profilePicture || undefined,
        updatedBy,
      });

      // Remove document fields from user update (they go to user_documents)
      delete processedData.aadharDoc;
      delete processedData.panDoc;
      delete processedData.esicDoc;
      delete processedData.dlDoc;

      if (processedData.dateOfBirth && typeof processedData.dateOfBirth === 'string') {
        processedData.dateOfBirth = new Date(processedData.dateOfBirth);
      }
      if (processedData.dateOfJoining && typeof processedData.dateOfJoining === 'string') {
        processedData.dateOfJoining = new Date(processedData.dateOfJoining);
      }

      await this.userRepository.update({ id }, processedData);

      // Handle document updates - replaces old documents of the same type (isUpdate = true)
      await this.createUserDocuments(id, uploadedFiles, updatedBy, entityManager, true);

      return this.utilityService.getSuccessMessage(
        USER_FIELD_NAMES.USER,
        DataSuccessOperationType.UPDATE,
      );
    });
  }

  async delete(id: string, deletedBy: string) {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(USERS_ERRORS.NOT_FOUND);
      }

      // Only archived users can be deleted
      if (user.status !== UserStatus.ARCHIVED) {
        throw new BadRequestException(USERS_ERRORS.USER_NOT_ARCHIVED_TO_DELETE);
      }

      await this.userRepository.delete(id, deletedBy);
      return this.utilityService.getSuccessMessage(
        USER_FIELD_NAMES.USER,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }

  async bulkDelete(bulkDeleteDto: BulkDeleteUserDto) {
    const { userIds, deletedBy } = bulkDeleteDto;
    const result: { userId: string; message: string }[] = [];
    const errors: { userId: string; error: string }[] = [];

    for (const userId of userIds) {
      try {
        await this.validateAndDeleteUser(userId, deletedBy);
        result.push({
          userId,
          message: USERS_RESPONSES.USER_DELETE_SUCCESS,
        });
      } catch (error) {
        errors.push({
          userId,
          error: error.message,
        });
      }
    }

    return {
      message: USERS_RESPONSES.BULK_DELETE_PROCESSED.replace('{length}', userIds.length.toString())
        .replace('{success}', result.length.toString())
        .replace('{error}', errors.length.toString()),
      result,
      errors,
    };
  }

  private async validateAndDeleteUser(userId: string, deletedBy: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(USERS_ERRORS.NOT_FOUND);
    }

    // Only archived users can be deleted
    if (user.status !== UserStatus.ARCHIVED) {
      throw new BadRequestException(USERS_ERRORS.USER_NOT_ARCHIVED_TO_DELETE);
    }

    await this.userRepository.delete(userId, deletedBy);

    return {
      userId,
      message: USERS_RESPONSES.USER_DELETE_SUCCESS,
    };
  }

  async getUserDocuments(userId: string) {
    const documents = await this.userDocumentService.findAll({
      where: { userId },
      order: { documentType: SortOrder.ASC, createdAt: SortOrder.DESC },
    });

    // Group documents by type
    const groupedDocs: Record<string, { id: string; fileKey: string; fileName: string }[]> = {};
    for (const doc of documents) {
      if (!groupedDocs[doc.documentType]) {
        groupedDocs[doc.documentType] = [];
      }
      groupedDocs[doc.documentType].push({
        id: doc.id,
        fileKey: doc.fileKey,
        fileName: doc.fileName,
      });
    }

    return groupedDocs;
  }

  async getDropdownOptions() {
    const configKeys = [
      { key: CONFIGURATION_KEYS.GENDERS, field: 'genders' },
      { key: CONFIGURATION_KEYS.BLOOD_GROUPS, field: 'bloodGroups' },
      { key: CONFIGURATION_KEYS.EMPLOYEE_TYPES, field: 'employeeTypes' },
      { key: CONFIGURATION_KEYS.DESIGNATIONS, field: 'designations' },
      { key: CONFIGURATION_KEYS.DEGREES, field: 'degrees' },
      { key: CONFIGURATION_KEYS.BRANCHES, field: 'branches' },
      { key: CONFIGURATION_KEYS.DOCUMENT_TYPES, field: 'documentTypes' },
    ];

    const dropdownOptions: Record<string, any[]> = {};

    for (const { key, field } of configKeys) {
      try {
        const configuration = await this.configurationService.findOne({ where: { key } });
        if (configuration) {
          const configSetting = await this.configSettingService.findOne({
            where: { configId: configuration.id, isActive: true },
          });
          dropdownOptions[field] = configSetting?.value || [];
        } else {
          dropdownOptions[field] = [];
        }
      } catch (error) {
        Logger.error(`Failed to fetch config for ${key}:`, error);
        dropdownOptions[field] = [];
      }
    }

    return dropdownOptions;
  }

  async getNextEmployeeId(): Promise<{ employeeId: string }> {
    const employeeId = await this.userRepository.getNextEmployeeId();
    return { employeeId };
  }

  validateEmployeeIdFormat(employeeId: string): boolean {
    return VALIDATION_PATTERNS.EMPLOYEE_ID.test(employeeId);
  }

  async validateEmployeeIdUniqueness(employeeId: string, excludeUserId?: string): Promise<void> {
    const existingUser = await this.userRepository.findOne({ where: { employeeId } });
    if (existingUser && existingUser.id !== excludeUserId) {
      throw new BadRequestException(USERS_ERRORS.EMPLOYEE_ID_ALREADY_EXISTS);
    }
  }

  private async validateDropdownFields(data: Record<string, any>): Promise<void> {
    const fieldsToValidate = [
      { field: 'gender', configKey: CONFIGURATION_KEYS.GENDERS, label: 'Gender' },
      { field: 'bloodGroup', configKey: CONFIGURATION_KEYS.BLOOD_GROUPS, label: 'Blood Group' },
      {
        field: 'employeeType',
        configKey: CONFIGURATION_KEYS.EMPLOYEE_TYPES,
        label: 'Employee Type',
      },
      { field: 'designation', configKey: CONFIGURATION_KEYS.DESIGNATIONS, label: 'Designation' },
      { field: 'degree', configKey: CONFIGURATION_KEYS.DEGREES, label: 'Degree' },
      { field: 'branch', configKey: CONFIGURATION_KEYS.BRANCHES, label: 'Branch' },
    ];

    const errors: string[] = [];

    for (const { field, configKey, label } of fieldsToValidate) {
      const value = data[field];
      if (!value) continue;

      const validValues = await this.getValidValuesForConfig(configKey);
      if (validValues.length > 0 && !validValues.includes(value as string)) {
        errors.push(`Invalid ${label}: "${value}". Valid options: ${validValues.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  private async getValidValuesForConfig(configKey: string): Promise<string[]> {
    try {
      const configuration = await this.configurationService.findOne({ where: { key: configKey } });
      if (!configuration) {
        Logger.warn(`Configuration not found for key: ${configKey}`);
        return [];
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      if (!configSetting || !configSetting.value) return [];
      return configSetting.value.map((option: { value: string }) => option.value);
    } catch (error) {
      Logger.error(`Failed to get valid values for ${configKey}:`, error);
      return [];
    }
  }

  async validateDocumentType(documentType: string): Promise<void> {
    const validTypes = await this.getValidValuesForConfig(CONFIGURATION_KEYS.DOCUMENT_TYPES);
    if (validTypes.length > 0 && !validTypes.includes(documentType)) {
      throw new BadRequestException(
        USER_DOCUMENT_ERRORS.INVALID_DOCUMENT_TYPE.replace(
          '{documentTypes}',
          validTypes.join(', '),
        ),
      );
    }
  }

  private async handleFileUploads(
    files: {
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
    userEmail: string,
  ): Promise<Record<string, string>> {
    const uploadedPaths: Record<string, string> = {};
    const timestamp = Date.now();
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');

    const fileFieldMappings = [
      { field: 'profilePicture', folder: FILE_UPLOAD_FOLDER_NAMES.PROFILE_PICTURES },
      { field: 'esicDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
      { field: 'aadharDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
      { field: 'panDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
      { field: 'dlDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
      { field: 'uanDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
      { field: 'passportDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
      { field: 'degreeDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
      { field: 'offerLetterDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
      { field: 'experienceLetterDoc', folder: FILE_UPLOAD_FOLDER_NAMES.EMPLOYEE_FILES },
    ];

    for (const mapping of fileFieldMappings) {
      const fileArray = files[mapping.field as keyof typeof files];
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        const extension = file.originalname.split('.').pop();
        const key = `${mapping.folder}/${sanitizedEmail}/${mapping.field}_${timestamp}.${extension}`;

        try {
          await this.filesService.uploadFile(file.buffer, key, file.mimetype);
          uploadedPaths[mapping.field] = key;
          Logger.log(`Uploaded ${mapping.field} to ${key}`);
        } catch (error) {
          Logger.error(`Failed to upload ${mapping.field}:`, error);
          throw error;
        }
      }
    }

    return uploadedPaths;
  }

  private async cleanupUploadedFiles(uploadedFiles: Record<string, string>): Promise<void> {
    for (const [field, key] of Object.entries(uploadedFiles)) {
      try {
        await this.filesService.deleteFile(key);
        Logger.log(`Cleaned up ${field}: ${key}`);
      } catch (error) {
        Logger.error(`Failed to cleanup ${field}: ${key}`, error);
      }
    }
  }

  async resendPasswordLinks(dto: ResendPasswordLinkDto): Promise<{
    message: string;
    results: Array<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      resetLink: string;
      status: 'success' | 'error';
      error?: string;
    }>;
  }> {
    const results: Array<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      resetLink: string;
      status: 'success' | 'error';
      error?: string;
    }> = [];

    for (const userId of dto.userIds) {
      try {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
          results.push({
            userId,
            email: '',
            firstName: '',
            lastName: '',
            resetLink: '',
            status: 'error',
            error: USERS_ERRORS.NOT_FOUND,
          });
          continue;
        }

        if (user.status === UserStatus.ARCHIVED) {
          results.push({
            userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            resetLink: '',
            status: 'error',
            error: 'User is archived',
          });
          continue;
        }

        // Generate token
        const token = this.jwtService.sign(
          { email: user.email },
          { expiresIn: Environments.FORGET_PASSWORD_TOKEN_EXPIRY },
        );
        const encryptedToken = this.utilityService.encrypt(token);
        const resetPasswordLink = `${Environments.API_BASE_URL}${AUTH_REDIRECT_ROUTES.TOKEN_VALIDATION}${encryptedToken}`;

        results.push({
          userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          resetLink: resetPasswordLink,
          status: 'success',
        });

        Logger.log(`Generated password reset link for user: ${user.email}`);
      } catch (error) {
        results.push({
          userId,
          email: '',
          firstName: '',
          lastName: '',
          resetLink: '',
          status: 'error',
          error: error.message || 'Unknown error',
        });
      }
    }

    return {
      message: USERS_RESPONSES.PASSWORD_LINK_RESENT,
      results,
    };
  }
}
