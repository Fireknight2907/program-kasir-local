import './globals.css';

export const metadata = {
  title: 'Kasir Pintar - Offline POS System',
  description: 'Sistem Kasir Offline dengan fitur pemesanan QR Code',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
