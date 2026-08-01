export default function ScooterIllustration() {
    return (
        <div className="hero-illust">
            <svg viewBox="0 0 480 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rider delivering food on a scooter">
                <circle cx="240" cy="210" r="200" fill="rgba(255,255,255,0.16)" />
                <circle cx="240" cy="210" r="150" fill="rgba(255,255,255,0.14)" />

                <circle cx="90" cy="80" r="26" fill="#ffe0b3" />

                <ellipse cx="370" cy="90" rx="34" ry="16" fill="#ffffff" opacity="0.85" />
                <ellipse cx="392" cy="82" rx="22" ry="14" fill="#ffffff" opacity="0.85" />

                <rect x="0" y="330" width="480" height="26" fill="#2b2118" opacity="0.18" />
                <rect x="20" y="341" width="40" height="5" rx="2.5" fill="#ffffff" opacity="0.6" />
                <rect x="90" y="341" width="40" height="5" rx="2.5" fill="#ffffff" opacity="0.6" />
                <rect x="160" y="341" width="40" height="5" rx="2.5" fill="#ffffff" opacity="0.6" />

                <rect x="30" y="230" width="46" height="6" rx="3" fill="#ffffff" opacity="0.6" />
                <rect x="18" y="250" width="34" height="6" rx="3" fill="#ffffff" opacity="0.5" />

                <g>
                    <ellipse cx="230" cy="320" rx="140" ry="10" fill="#2b2118" opacity="0.12" />
                    <circle cx="150" cy="300" r="26" fill="#2b2118" />
                    <circle cx="150" cy="300" r="12" fill="#f5f9ff" />
                    <circle cx="300" cy="300" r="26" fill="#2b2118" />
                    <circle cx="300" cy="300" r="12" fill="#f5f9ff" />

                    <path d="M150 300 L190 300 L215 250 L270 250 L300 300" stroke="#2b2118" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="205" y="215" width="14" height="45" rx="6" fill="#2b2118" />
                    <rect x="185" y="205" width="55" height="16" rx="8" fill="#ffffff" />

                    <rect x="255" y="205" width="60" height="55" rx="8" fill="#ffffff" />
                    <rect x="255" y="205" width="60" height="55" rx="8" fill="none" stroke="#2f7dd8" strokeWidth="4" />
                    <path d="M262 224 H308" stroke="#2f7dd8" strokeWidth="4" strokeLinecap="round" />
                    <path d="M285 213 V255" stroke="#2f7dd8" strokeWidth="4" strokeLinecap="round" />

                    <circle cx="205" cy="150" r="20" fill="#8fc3ff" />
                    <path d="M188 150 a17 17 0 0 1 34 0" fill="#2b2118" />
                    <path d="M195 168 Q205 185 240 195 L250 250 L215 250 L205 210 Z" fill="#2f7dd8" />
                    <path d="M240 195 Q265 205 270 235" stroke="#2f7dd8" strokeWidth="16" fill="none" strokeLinecap="round" />
                </g>
            </svg>
        </div>
    );
}
