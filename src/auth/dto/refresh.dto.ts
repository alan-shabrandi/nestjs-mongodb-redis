import { UserDto } from 'src/users/dto/user.dto';

export class RefreshResponseDto {
  access_token: string;
  refresh_token: string;
  user: UserDto;
}
