import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCurrentUser } from '@/lib/session';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();

    return (
        <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header user={user} />
            <main style={{ flex: 1 }}>{children}</main>
            <Footer />
        </div>
    );
}
