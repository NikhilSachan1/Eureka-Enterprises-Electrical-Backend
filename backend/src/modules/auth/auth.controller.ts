import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Response } from 'express';
import { SignInDto, ForgetPasswordDto, ResetPasswordDto } from './dto';
import { AUTH_RESPONSES } from './constants/auth.constants';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('sign-in')
  async signIn(@Body() body: SignInDto) {
    return this.authService.signIn(body);
  }

  @ApiBearerAuth('JWT-auth')
  @Post('sign-out')
  async signOut() {
    return { message: AUTH_RESPONSES.SIGN_OUT_SUCCESS };
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
