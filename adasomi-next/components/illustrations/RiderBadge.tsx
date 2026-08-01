export default function RiderBadgeIllustration() {
    return (
        <div className="illust-banner">
            <svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Delivery rider with a helmet and dispatch bike">
                <rect width="400" height="150" fill="#e9f2fd" />
                <rect x="0" y="118" width="400" height="32" fill="#cfe3fa" />

                <g transform="translate(70,25)">
                    <path d="M10 55 a45 45 0 0 1 90 0 v10 h-90 Z" fill="#2f7dd8" />
                    <rect x="0" y="55" width="110" height="14" rx="7" fill="#2b2118" />
                    <rect x="20" y="35" width="70" height="24" rx="10" fill="#cfe9f2" />
                </g>

                <g transform="translate(190,55)">
                    <circle cx="30" cy="70" r="24" fill="#2b2118" />
                    <circle cx="30" cy="70" r="10" fill="#f5f9ff" />
                    <circle cx="150" cy="70" r="24" fill="#2b2118" />
                    <circle cx="150" cy="70" r="10" fill="#f5f9ff" />
                    <path d="M30 70 L65 70 L88 30 L130 30 L150 70" stroke="#2b2118" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="118" y="20" width="45" height="42" rx="8" fill="#ffffff" stroke="#2f7dd8" strokeWidth="4" />
                    <path d="M126 40 H155" stroke="#2f7dd8" strokeWidth="3" strokeLinecap="round" />
                </g>

                <rect x="330" y="60" width="40" height="6" rx="3" fill="#2f7dd8" opacity="0.5" />
                <rect x="340" y="76" width="30" height="6" rx="3" fill="#2f7dd8" opacity="0.4" />
            </svg>
        </div>
    );
}
