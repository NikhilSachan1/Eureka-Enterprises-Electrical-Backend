import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import { Environments } from '../../../env-configs';
import { SignInDto, ResetPasswordDto, SignupDto } from './dto';
import { AUTH_ERRORS, AUTH_RESPONSES, AUTH_REDIRECT_ROUTES } from './constants/auth.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { MailService } from '../common/email/email.service';
import { UserStatus } from '../users/constants/user.constants';
import { RoleService } from '../roles/role.service';
import { UserRoleService } from '../user-roles/user-role.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private jwtService: JwtService,
    private utilityService: UtilityService,
    private mailService: MailService,
    private roleService: RoleService,
    private userRoleService: UserRoleService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findOne({ email });
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.EMAIL_NOT_EXISTS);
    } else if (user.status === UserStatus.ARCHIVED) {
      throw new ForbiddenException(AUTH_ERRORS.USER_ARCHIVED);
    }
    const isPasswordMatch = this.utilityService.compare(password, user.password);
    if (user && isPasswordMatch) {
      return user;
    }
    return null;
  }

  async signIn(user: SignInDto) {
    const { email, password } = user;
    const validatedUser = await this.validateUser(email, password);
    if (!validatedUser) throw new BadRequestException(AUTH_ERRORS.INVALID_CREDENTIALS);
    const { id, firstName, lastName, email: userEmail, role } = validatedUser;
    const tokenPayload = { id, email: userEmail, role };
    return {
      token: this.jwtService.sign(tokenPayload),
      name: `${firstName} ${lastName}`,
      email: userEmail,
      firstName,
      lastName,
      designation: [
        'Senior Software Engineer',
        'Software Engineer',
        'Electrical Engineer',
        'Site Manager',
        'Human Resources',
      ][Math.floor(Math.random() * 5)], //TODO: Configure this with the actual designation
      profilePicture:
        'https://images.unsplash.com/photo-1628563694622-5a76957fd09c?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      role,
    };
  }

  async forgetPassword(emailId: string) {
    try {
      const user = await this.userService.findOne({ email: emailId });
      if (!user) throw new NotFoundException(AUTH_ERRORS.EMAIL_NOT_EXISTS);
      if (user.status === UserStatus.ARCHIVED) {
        throw new BadRequestException(AUTH_ERRORS.USER_ARCHIVED);
      }
      const token = this.jwtService.sign(
        { email: user.email },
        { expiresIn: Environments.FORGET_PASSWORD_TOKEN_EXPIRY },
      );
      const encryptedToken = this.utilityService.encrypt(token);
      const resetPasswordLink = `${Environments.API_BASE_URL}${AUTH_REDIRECT_ROUTES.TOKEN_VALIDATION}${encryptedToken}`;
      Logger.log(resetPasswordLink);
      await this.mailService.sendMail({
        receiverEmails: [user.email],
        subject: 'Enter Subject',
        template: 'Enter template',
        emailData: {
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });

      return {
        message: AUTH_RESPONSES.FORGET_PASSWORD,
      };
    } catch (error) {
      throw error;
    }
  }

  async resetPassword(resetPasswordDetails: ResetPasswordDto, tokenHash: string) {
    try {
      const decryptedToken = this.utilityService.decrypt(tokenHash);
      const { email, iat } = await this.validateJWT(decryptedToken);
      if (!email) {
        throw new GoneException(AUTH_ERRORS.RESET_PASSWORD_LINK_EXPIRED);
      }

      const user = await this.userService.findOne({ email });
      if (!user) throw new NotFoundException(AUTH_ERRORS.EMAIL_NOT_EXISTS);

      if (user && user.passwordUpdatedAt) {
        const tokenIssuedAt = iat * 1000;

        if (user.passwordUpdatedAt.getTime() > tokenIssuedAt) {
          throw new GoneException(AUTH_ERRORS.RESET_PASSWORD_LINK_EXPIRED);
        }
      }

      const { newPassword, confirmPassword } = resetPasswordDetails;
      if (newPassword !== confirmPassword)
        throw new BadRequestException(AUTH_ERRORS.PASSWORDS_DO_NOT_MATCH);

      const { id } = user;
      await this.userService.update(
        { id },
        {
          password: this.utilityService.createHash(confirmPassword),
          passwordUpdatedAt: new Date(),
          updatedBy: id,
        },
      );
      return {
        message: AUTH_RESPONSES.PASSWORD_RESET,
      };
    } catch (error) {
      throw error;
    }
  }

  async resetPasswordTokenValidation(tokenHash: string) {
    try {
      const decryptedToken = this.utilityService.decrypt(tokenHash);
      const { email } = await this.validateJWT(decryptedToken);
      const { email: urlEmail } = await this.jwtService.decode(decryptedToken);
      if (!email) {
        return `${Environments.FE_BASE_URL}${AUTH_REDIRECT_ROUTES.RESET_PASSWORD_FAILURE_REDIRECT}${urlEmail}`;
      } else {
        return `${
          Environments.FE_BASE_URL
        }${AUTH_REDIRECT_ROUTES.RESET_PASSWORD_SUCCESS_REDIRECT.replace(
          '{resetToken}',
          tokenHash,
        ).replace('{email}', email)}`;
      }
    } catch (error) {
      throw error;
    }
  }

  async validateJWT(token: string) {
    try {
      const payload = await this.jwtService.verify(token);
      return payload;
    } catch (error) {
      return false;
    }
  }

  async signUp(signupDto: SignupDto) {
    const { email, password, confirmPassword, role } = signupDto;

    // Input validation
    if (password !== confirmPassword) {
      throw new BadRequestException(AUTH_ERRORS.PASSWORDS_DO_NOT_MATCH);
    }

    // Pre-transaction checks
    const [existingUser, roleEntity] = await Promise.all([
      this.userService.findOne({ email }),
      this.roleService.findOne({ where: { name: role } }),
    ]);

    if (existingUser) {
      throw new BadRequestException(AUTH_ERRORS.EMAIL_ALREADY_EXISTS);
    }

    if (!roleEntity) {
      throw new NotFoundException(AUTH_ERRORS.ROLE_NOT_FOUND);
    }

    // Execute in transaction
    return await this.dataSource.transaction(async (entityManager) => {
      try {
        // Create user
        const userData = {
          ...signupDto,
          password: this.utilityService.createHash(password),
          status: UserStatus.ACTIVE,
        };

        const user = await this.userService.create(userData, entityManager);

        // Create user role assignment
        await this.userRoleService.create(
          {
            userId: user.id,
            roleId: roleEntity.id,
          },
          entityManager,
        );

        return {
          id: user.id,
          message: AUTH_RESPONSES.SIGNUP_SUCCESS,
        };
      } catch (error) {
        Logger.error('SignUp transaction failed:', error);
        throw error;
      }
    });
  }
}
