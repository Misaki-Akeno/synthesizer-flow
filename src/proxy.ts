import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export const proxy = createMiddleware(routing);

export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(zh-CN|en-US)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};
