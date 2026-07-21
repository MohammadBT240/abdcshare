import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './presentation/dto/login.dto';
import { RefreshDto } from './presentation/dto/refresh.dto';
import { ChangePasswordDto } from './presentation/dto/change-password.dto';
import { AuthTokensDto, AuthUserDto } from './presentation/dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto): Promise<Pick<AuthTokensDto, 'accessToken' | 'refreshToken'>> {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser('userId') userId: string): Promise<AuthUserDto> {
    return this.auth.me(userId);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(userId, dto);
  }
}
