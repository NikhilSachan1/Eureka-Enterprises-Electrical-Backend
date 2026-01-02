import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Request, Response } from 'express';
import {
  SignInDto,
  ForgetPasswordDto,
  ResetPasswordDto,
  SwitchRoleDto,
  RefreshTokenDto,
} from './dto';
import { AuthenticatedRequest } from './auth.types';

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
  async signIn(@Req() req: Request, @Body() body: SignInDto) {
    return this.authService.signIn(body, this.getRequestMetadata(req));
  }

  @Public()
  @Post('refresh-token')
  async refreshToken(@Req() req: Request, @Body() body: RefreshTokenDto) {
    return this.authService.refreshAccessToken(body, this.getRequestMetadata(req));
  }

  @ApiBearerAuth('JWT-auth')
  @Post('sign-out')
  async signOut(@Body() body?: RefreshTokenDto) {
    return this.authService.signOut(body?.refreshToken);
  }

  @ApiBearerAuth('JWT-auth')
  @Post('sign-out-all-devices')
  async signOutAllDevices(@Req() req: AuthenticatedRequest) {
    return this.authService.signOutAllDevices(req.user.id);
  }

  @ApiBearerAuth('JWT-auth')
  @Post('switch-role')
  async switchRole(@Req() req: AuthenticatedRequest, @Body() body: SwitchRoleDto) {
    return this.authService.switchRole(req.user, body);
  }

  @Public()
  @Post('forget-password')
  async forgetPassword(@Body() body: ForgetPasswordDto) {
    return this.authService.forgetPassword(body.email);
  }

  @Public()
  @Post('reset-password/:token')
  async resetPassword(@Param('token') token: string, @Body() body: ResetPasswordDto) {
    return await this.authService.resetPassword(body, token);
  }

  @Public()
  @Get('validate/:token')
  async resetPasswordTokenValidation(@Res() res: Response, @Param('token') token: string) {
    const redirectLink = await this.authService.resetPasswordTokenValidation(token);
    res.redirect(redirectLink);
  }
}
