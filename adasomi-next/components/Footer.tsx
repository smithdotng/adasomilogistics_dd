import Image from 'next/image';

export default function Footer() {
    return (
        <footer className="app-footer">
            <div className="container d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                <div className="d-flex align-items-center gap-3">
                    <span className="brand-logo-chip">
                        <Image src="/images/logo.png" alt="Adasomi Logistics" width={144} height={58} style={{ height: 28, width: 'auto', display: 'block' }} />
                    </span>
                    <span>© {new Date().getFullYear()} Adasomi Logistics Dispatch &amp; Delivery Platform. All rights reserved.</span>
                </div>
                <div className="small">Escrow-secured payments &middot; Verified rider fleets &middot; Real-time dispatch</div>
            </div>
        </footer>
    );
}
