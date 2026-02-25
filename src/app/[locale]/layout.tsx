import type { Metadata } from 'next';
import '../globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Toaster } from '@/components/ui/shadcn/sonner';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
    title: 'Synthesizer Flow',
    description: 'A modular synthesizer web application',
};

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;

    if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
        notFound();
    }

    setRequestLocale(locale);

    const messages = await getMessages();

    return (
        <html lang={locale}>
            <body className={`antialiased`}>
                <NextIntlClientProvider messages={messages}>
                    <AuthProvider>{children}</AuthProvider>
                    <Toaster />
                    {process.env.NODE_ENV === 'production' && (
                        <>
                            <SpeedInsights />
                            <Analytics />
                        </>
                    )}
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
