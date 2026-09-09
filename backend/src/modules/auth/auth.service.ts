import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import { Environments } from '../../../env-configs';
import {
  SignInDto,
  ResetPasswordDto,
  SwitchRoleDto,
  RefreshTokenDto,
  AdminResetPasswordDto,
} from './dto';
import {
  AUTH_ERRORS,
  AUTH_RESPONSES,
  AUTH_REDIRECT_ROUTES,
  ADMIN_RESETTABLE_TARGET_ROLES,
} from './constants/auth.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { EmailService } from '../common/email/email.service';
import { UserStatus } from '../users/constants/user.constants';
import { UserRoleService } from '../user-roles/user-role.service';
import { EMAIL_SUBJECT, EMAIL_TEMPLATE } from '../common/email/constants/email.constants';
import { WhatsAppService } from '../common/whatsapp/whatsapp.service';
import { JwtPayload, UserFromRequest, RefreshTokenPayload, RequestMetadata } from './auth.types';
import { RefreshTokenRepository } from './refresh-token.repository';
import { v4 as uuidv4 } from 'uuid';
import { LessThan } from 'typeorm';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private jwtService: JwtService,
    private utilityService: UtilityService,
    private emailService: EmailService,
    private userRoleService: UserRoleService,
    private refreshTokenRepository: RefreshTokenRepository,
    private whatsAppService: WhatsAppService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findOne({ email });
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.EMAIL_NOT_EXISTS);
    } else if (user.status === UserStatus.ARCHIVED) {
      throw new ForbiddenException(AUTH_ERRORS.USER_ARCHIVED);
    }

    const userRoles = await this.userRoleService.findAll({
      where: { userId: user.id },
      relations: ['role'],
    });

    if (!userRoles || userRoles.length === 0) {
      throw new ForbiddenException(AUTH_ERRORS.USER_HAS_NO_ROLES);
    }

    const roles = userRoles.map((userRole) => userRole.role.name);

    const isPasswordMatch = this.utilityService.compare(password, user.password);
    if (user && isPasswordMatch) {
      return { ...user, roles };
    }
    return null;
  }

  private generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: Environments.JWT_AUTH_SECRET_KEY,
      expiresIn: Environments.JWT_AUTH_TOKEN_EXPIRY,
    });
  }

  private generateRefreshToken(payload: RefreshTokenPayload, expiresAt: Date): string {
    const expiresInSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    return this.jwtService.sign(payload, {
      secret: Environments.JWT_REFRESH_SECRET_KEY,
      expiresIn: expiresInSeconds > 0 ? expiresInSeconds : 1,
    });
  }

  private getRefreshTokenExpiryDate(): Date {
    const expiryDays = Environments.JWT_REFRESH_TOKEN_EXPIRY_DAYS;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    return expiryDate;
  }

  async signIn(user: SignInDto, metadata?: RequestMetadata) {
    const { email, password } = user;
    const validatedUser = await this.validateUser(email, password);
    if (!validatedUser) throw new BadRequestException(AUTH_ERRORS.INVALID_CREDENTIALS);

    const {
      id,
      firstName,
      lastName,
      email: userEmail,
      roles,
      designation,
      profilePicture,
    } = validatedUser;

    const defaultActiveRole = roles[0];

    const accessTokenPayload: JwtPayload = {
      id,
      email: userEmail,
      roles,
      activeRole: defaultActiveRole,
    };
    const accessToken = this.generateAccessToken(accessTokenPayload);

    const sessionExpiresAt = this.getRefreshTokenExpiryDate();
    const tokenId = uuidv4();
    const refreshTokenPayload: RefreshTokenPayload = {
      userId: id,
      tokenId,
    };
    const refreshToken = this.generateRefreshToken(refreshTokenPayload, sessionExpiresAt);

    await this.refreshTokenRepository.create({
      userId: id,
      token: refreshToken,
      expiresAt: sessionExpiresAt,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      name: `${firstName} ${lastName}`,
      email: userEmail,
      firstName,
      lastName,
      designation: designation,
      profilePicture: profilePicture || null,
      roles,
      activeRole: defaultActiveRole,
      expiresIn: Environments.JWT_AUTH_TOKEN_EXPIRY,
      userId: id,
    };
  }

  async refreshAccessToken(refreshTokenDto: RefreshTokenDto, metadata?: RequestMetadata) {
    const { refreshToken } = refreshTokenDto;

    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: Environments.JWT_REFRESH_SECRET_KEY,
      });
    } catch {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, isRevoked: false },
    });

    if (!storedToken) {
      throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_NOT_FOUND);
    }

    if (new Date() > storedToken.expiresAt) {
      await this.refreshTokenRepository.update({ token: refreshToken }, { isRevoked: true });
      throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_EXPIRED);
    }

    const user = await this.userService.findOne({ id: payload.userId, deletedAt: null });
    if (!user || user.status === UserStatus.ARCHIVED) {
      await this.refreshTokenRepository.update({ userId: payload.userId }, { isRevoked: true });
      throw new UnauthorizedException(AUTH_ERRORS.USER_ARCHIVED);
    }

    const userRoles = await this.userRoleService.findAll({
      where: { userId: user.id },
      relations: ['role'],
    });

    if (!userRoles || userRoles.length === 0) {
      await this.refreshTokenRepository.update({ userId: user.id }, { isRevoked: true });
      throw new ForbiddenException(AUTH_ERRORS.USER_HAS_NO_ROLES);
    }

    const roles = userRoles.map((ur) => ur.role.name);
    const defaultActiveRole = roles[0];

    const accessTokenPayload: JwtPayload = {
      id: user.id,
      email: user.email,
      roles,
      activeRole: defaultActiveRole,
    };
    const newAccessToken = this.generateAccessToken(accessTokenPayload);

    await this.refreshTokenRepository.update({ token: refreshToken }, { isRevoked: true });

    const newTokenId = uuidv4();
    const newRefreshTokenPayload: RefreshTokenPayload = {
      userId: user.id,
      tokenId: newTokenId,
    };
    const newRefreshToken = this.generateRefreshToken(
      newRefreshTokenPayload,
      storedToken.expiresAt,
    );

    await this.refreshTokenRepository.create({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: storedToken.expiresAt,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      roles,
      activeRole: defaultActiveRole,
      expiresIn: Environments.JWT_AUTH_TOKEN_EXPIRY,
      message: AUTH_RESPONSES.TOKEN_REFRESHED,
    };
  }

  async signOut(refreshToken?: string) {
    if (refreshToken) {
      await this.refreshTokenRepository.update({ token: refreshToken }, { isRevoked: true });
    }
    return { message: AUTH_RESPONSES.SIGN_OUT_SUCCESS };
  }

  async signOutAllDevices(userId: string) {
    await this.refreshTokenRepository.update({ userId, isRevoked: false }, { isRevoked: true });
    return { message: AUTH_RESPONSES.ALL_SESSIONS_REVOKED };
  }

  async switchRole(currentUser: UserFromRequest, switchRoleDto: SwitchRoleDto) {
    const { targetRole } = switchRoleDto;

    if (!currentUser.roles.includes(targetRole)) {
      throw new ForbiddenException(AUTH_ERRORS.ROLE_SWITCH_UNAUTHORIZED);
    }

    const user = await this.userService.findOne({ id: currentUser.id, deletedAt: null });
    if (!user || user.status === UserStatus.ARCHIVED) {
      throw new UnauthorizedException(AUTH_ERRORS.USER_ARCHIVED);
    }

    const userRoles = await this.userRoleService.findAll({
      where: { userId: user.id },
      relations: ['role'],
    });

    const currentRoles = userRoles.map((userRole) => userRole.role.name);

    if (!currentRoles.includes(targetRole)) {
      throw new ForbiddenException(AUTH_ERRORS.ROLE_SWITCH_UNAUTHORIZED);
    }

    // Only issue new ACCESS token with updated role
    // Refresh token stays the same (it's about SESSION, not ROLE)
    const accessTokenPayload: JwtPayload = {
      id: user.id,
      email: user.email,
      roles: currentRoles,
      activeRole: targetRole,
    };
    const accessToken = this.generateAccessToken(accessTokenPayload);

    return {
      accessToken,
      roles: currentRoles,
      activeRole: targetRole,
      expiresIn: Environments.JWT_AUTH_TOKEN_EXPIRY,
      message: AUTH_RESPONSES.ROLE_SWITCHED,
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
      await this.emailService.sendMail({
        receiverEmails: [user.email],
        subject: EMAIL_SUBJECT.FORGET_PASSWORD,
        template: EMAIL_TEMPLATE.FORGET_PASSWORD,
        emailData: {
          firstName: user.firstName,
          lastName: user.lastName,
          resetPasswordLink: resetPasswordLink,
          currentYear: this.utilityService.getCurrentYear(),
        },
      });

      // Send WhatsApp notification (if opted in)
      const whatsappNumber = user.whatsappNumber || user.contactNumber;
      if (user.whatsappOptIn && whatsappNumber) {
        this.whatsAppService
          .sendForgetPassword(
            whatsappNumber,
            {
              employeeName: `${user.firstName} ${user.lastName}`,
              resetLink: resetPasswordLink,
            },
            { referenceId: user.id, recipientId: user.id },
          )
          .catch((err) =>
            Logger.error(`Failed to send WhatsApp forget password to ${user.email}:`, err),
          );
      }

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

      await this.refreshTokenRepository.update(
        { userId: id, isRevoked: false },
        { isRevoked: true },
      );

      return {
        message: AUTH_RESPONSES.PASSWORD_RESET,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * An admin sets another user's password directly, then shares it out-of-band.
   *
   * Exists for the case the emailed link cannot serve: a driver with no working email address has
   * no way to receive a reset link at all.
   *
   * Restricted to targets holding only EMPLOYEE / DRIVER. That is a privilege-escalation guard, not
   * a convenience filter — HR legitimately holds the reset permission, so without it an HR user
   * could reset the SUPER_ADMIN's password and immediately sign in as them. The permission check
   * cannot catch that, because the permission is exactly what they are supposed to have.
   *
   * On success it mirrors the self-service reset above: bcrypt hash, bump `passwordUpdatedAt` (which
   * also expires any reset link already sitting in the target's inbox, since resetPassword compares
   * it against the link's `iat`), and revoke every active refresh token so no existing session
   * outlives the reset.
   */
  async adminResetUserPassword(
    targetUserId: string,
    dto: AdminResetPasswordDto,
    actorUserId: string,
  ) {
    const { newPassword, confirmPassword } = dto;
    if (newPassword !== confirmPassword) {
      throw new BadRequestException(AUTH_ERRORS.PASSWORDS_DO_NOT_MATCH);
    }

    if (targetUserId === actorUserId) {
      throw new ForbiddenException(AUTH_ERRORS.RESET_TARGET_SELF);
    }

    const target = await this.userService.findOne({ id: targetUserId, deletedAt: null });
    if (!target) {
      throw new NotFoundException(AUTH_ERRORS.EMAIL_NOT_EXISTS);
    }

    const targetRoles = await this.userRoleService.findAll({
      where: { userId: targetUserId },
      relations: ['role'],
    });
    if (!targetRoles || targetRoles.length === 0) {
      throw new ForbiddenException(AUTH_ERRORS.RESET_TARGET_HAS_NO_ROLES);
    }

    // Every role the target holds must be resettable — holding one privileged role is enough to
    // block, otherwise an admin who also has EMPLOYEE would slip through.
    const roleNames = targetRoles.map((ur) => ur.role.name);
    const hasOnlyResettableRoles = roleNames.every((name) =>
      ADMIN_RESETTABLE_TARGET_ROLES.includes(String(name).toUpperCase()),
    );
    if (!hasOnlyResettableRoles) {
      throw new ForbiddenException(AUTH_ERRORS.RESET_TARGET_NOT_ALLOWED);
    }

    await this.userService.update(
      { id: targetUserId },
      {
        password: this.utilityService.createHash(confirmPassword),
        passwordUpdatedAt: new Date(),
        updatedBy: actorUserId,
      },
    );

    await this.refreshTokenRepository.update(
      { userId: targetUserId, isRevoked: false },
      { isRevoked: true },
    );

    this.logger.log(`Password for user ${targetUserId} was reset by ${actorUserId}`);

    // Deliberately does not echo the password back — the caller typed it and already has it, and
    // returning it would put a live credential into response logs and browser history.
    return { message: AUTH_RESPONSES.PASSWORD_RESET };
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
    } catch {
      return false;
    }
  }

  async cleanupExpiredTokens() {
    await this.refreshTokenRepository.delete({ expiresAt: LessThan(new Date()) });
  }
}
