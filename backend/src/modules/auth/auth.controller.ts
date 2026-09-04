import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Request, Response } from 'express';
import {
  SignInDto,
  ForgetPasswordDto,
  ResetPasswordDto,
  SwitchRoleDto,
  RefreshTokenDto,
  AdminResetPasswordDto,
} from './dto';
import { AuthenticatedRequest } from './auth.types';
import { RequiredPermission } from './decorators/required-permission.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private getRequestMetadata(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString(),
    };
  }

  @Public()
  @Post('sign-in')
  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticates user credentials and returns access token along with refresh token.',
  })
  async signIn(@Req() req: Request, @Body() body: SignInDto) {
    return this.authService.signIn(body, this.getRequestMetadata(req));
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generates a new access token using a valid refresh token.',
  })
  async refreshToken(@Req() req: Request, @Body() body: RefreshTokenDto) {
    return this.authService.refreshAccessToken(body, this.getRequestMetadata(req));
  }

  @ApiBearerAuth('JWT-auth')
  @Post('sign-out')
  @ApiOperation({
    summary: 'Sign out user',
    description: 'Invalidates the refresh token and signs out the user from the current device.',
  })
  async signOut(@Body() body?: RefreshTokenDto) {
    return this.authService.signOut(body?.refreshToken);
  }

  @ApiBearerAuth('JWT-auth')
  @Post('sign-out-all-devices')
  @ApiOperation({
    summary: 'Sign out from all devices',
    description: 'Invalidates all refresh tokens and signs out the user from all devices.',
  })
  async signOutAllDevices(@Req() req: AuthenticatedRequest) {
    return this.authService.signOutAllDevices(req.user.id);
  }

  @ApiBearerAuth('JWT-auth')
  @Post('switch-role')
  @ApiOperation({
    summary: 'Switch user role',
    description:
      'Allows authenticated users to switch between their assigned roles and returns a new access token.',
  })
  async switchRole(@Req() req: AuthenticatedRequest, @Body() body: SwitchRoleDto) {
    return this.authService.switchRole(req.user, body);
  }

  @Public()
  @Post('forget-password')
  @ApiOperation({
    summary: 'Request password reset',
    description: "Sends a password reset link to the user's email address.",
  })
  async forgetPassword(@Body() body: ForgetPasswordDto) {
    return this.authService.forgetPassword(body.email);
  }

  @Public()
  @Post('reset-password/:token')
  @ApiOperation({
    summary: 'Reset password',
    description: 'Resets user password using a valid reset token received via email.',
  })
  async resetPassword(@Param('token') token: string, @Body() body: ResetPasswordDto) {
    return await this.authService.resetPassword(body, token);
  }

  @Post('users/:userId/reset-password')
  @RequiredPermission('employee.reset-password')
  @ApiOperation({
    summary: "Set an employee's or driver's password directly (admin / HR / operation manager)",
    description:
      'For users who cannot receive a reset link — a driver with no working email, for example. ' +
      'The caller sets the password and shares it out-of-band; the response never contains it. ' +
      'Restricted to targets holding only EMPLOYEE / DRIVER roles: a target with any privileged ' +
      'role returns 403, so this cannot be used to take over an admin account. Resetting your own ' +
      'password here is also rejected. On success the target is signed out of all devices and any ' +
      'outstanding reset link for them stops working.',
  })
  async adminResetUserPassword(
    @Req() { user: { id: actorUserId } }: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AdminResetPasswordDto,
  ) {
    return await this.authService.adminResetUserPassword(userId, body, actorUserId);
  }

  @Public()
  @Get('validate/:token')
  @ApiOperation({
    summary: 'Validate reset password token',
    description: 'Validates a password reset token and redirects to the appropriate page.',
  })
  async resetPasswordTokenValidation(@Res() res: Response, @Param('token') token: string) {
    const redirectLink = await this.authService.resetPasswordTokenValidation(token);
    res.redirect(redirectLink);
  }
}
