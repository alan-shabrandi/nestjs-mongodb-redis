import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({ example: 'access_token_here' })
  access_token: string;

  @ApiProperty({ example: 'refresh_token_here' })
  refresh_token: string;
}
