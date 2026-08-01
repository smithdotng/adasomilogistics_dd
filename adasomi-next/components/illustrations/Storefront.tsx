export default function StorefrontIllustration() {
    return (
        <div className="illust-banner">
            <svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Restaurant storefront with a produce crate">
                <rect width="400" height="150" fill="#e9f2fd" />
                <rect x="0" y="118" width="400" height="32" fill="#cfe3fa" />

                <rect x="70" y="55" width="150" height="70" fill="#ffffff" stroke="#cfe3fa" strokeWidth="2" />
                <path d="M62 55 L145 25 L228 55 Z" fill="#2f7dd8" />
                <rect x="62" y="55" width="166" height="12" fill="#1c5aa8" />
                <rect x="120" y="85" width="50" height="40" fill="#8fc3ff" />
                <rect x="90" y="70" width="24" height="24" fill="#cfe9f2" />
                <rect x="176" y="70" width="24" height="24" fill="#cfe9f2" />

                <path d="M70 55 h150 v10 l-15 12 h-120 l-15 -12 Z" fill="#ffffff" opacity="0.25" />

                <g transform="translate(255,80)">
                    <rect x="0" y="20" width="70" height="35" rx="4" fill="#8a5a3b" />
                    <rect x="4" y="24" width="62" height="27" rx="2" fill="#c98a5e" />
                    <circle cx="16" cy="18" r="11" fill="#e2544a" />
                    <circle cx="35" cy="14" r="12" fill="#6fa96a" />
                    <circle cx="54" cy="19" r="10" fill="#f0a63c" />
                </g>

                <path d="M105 68 q6 -10 0 -18 q-6 -8 0 -16" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
                <path d="M120 68 q6 -10 0 -18 q-6 -8 0 -16" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.5" />
            </svg>
        </div>
    );
}
