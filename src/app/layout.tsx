import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Delivery_OS — Sistema de Gestão de Entregas e Motoboys',
    template: '%s · Delivery_OS',
  },
  description:
    'Delivery_OS: gestão profissional de entregas, corridas de motoboys, empresas clientes, taxas e relatórios operacionais em tempo real.',
  applicationName: 'Delivery_OS',
  authors: [{ name: 'Delivery_OS' }],
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1a44f5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
