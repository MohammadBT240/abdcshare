export const ACCESS_COOKIE = 'abdc_access';
export const REFRESH_COOKIE = 'abdc_refresh';

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};
