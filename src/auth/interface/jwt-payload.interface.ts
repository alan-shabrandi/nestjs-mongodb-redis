export interface JwtPayload {
  userId: string;
  role: 'admin' | 'author' | 'user';
}
