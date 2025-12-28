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
import { SignInDto, ResetPasswordDto } from './dto';
import { AUTH_ERRORS, AUTH_RESPONSES, AUTH_REDIRECT_ROUTES } from './constants/auth.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { MailService } from '../common/email/email.service';
import { UserStatus } from '../users/constants/user.constants';
import { UserRoleService } from '../user-roles/user-role.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private jwtService: JwtService,
    private utilityService: UtilityService,
    private mailService: MailService,
    private userRoleService: UserRoleService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findOne({ email });
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.EMAIL_NOT_EXISTS);
    } else if (user.status === UserStatus.ARCHIVED) {
      throw new ForbiddenException(AUTH_ERRORS.USER_ARCHIVED);
    }
    const userRole = await this.userRoleService.findOne({
      where: { userId: user.id },
      relations: ['role'],
    });
    const isPasswordMatch = this.utilityService.compare(password, user.password);
    if (user && isPasswordMatch) {
      return { ...user, role: userRole.role.name };
    }
    return null;
  }

  async signIn(user: SignInDto) {
    const { email, password } = user;
    const validatedUser = await this.validateUser(email, password);
    if (!validatedUser) throw new BadRequestException(AUTH_ERRORS.INVALID_CREDENTIALS);
    const {
      id,
      firstName,
      lastName,
      email: userEmail,
      role,
      designation,
      profilePicture,
    } = validatedUser;
    const tokenPayload = { id, email: userEmail, role };
    return {
      token: this.jwtService.sign(tokenPayload),
      name: `${firstName} ${lastName}`,
      email: userEmail,
      firstName,
      lastName,
      designation: designation,
      profilePicture: profilePicture || null,
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
      //TODO: Add template name and subject
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
}
