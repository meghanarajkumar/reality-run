import { useEffect, useState } from 'react';
import qrcode from 'qrcode-generator';

function useQr(): string | null {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    const phone = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820;
    if (phone || !/^https?:$/.test(location.protocol)) return;
    const qr = qrcode(0, 'M');
    qr.addData(location.href.split('#')[0]); qr.make();
    const n: number = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    setPath(`${n}|${d}`);
  }, []);
  return path;
}

/** Pip, drawn flat for the landing page. */
function Mascot() {
  return (
    <div className="mascot" aria-hidden="true">
      <svg viewBox="0 0 200 150">
        <ellipse cx="100" cy="136" rx="46" ry="7" fill="#3B2A4A" opacity=".14" />
        <g className="leg leg-a"><rect x="82" y="104" width="13" height="24" rx="6.5" fill="#5B4B7A" /><ellipse cx="92" cy="129" rx="13" ry="7" fill="#5B4B7A" /></g>
        <g className="leg leg-b"><rect x="104" y="104" width="13" height="24" rx="6.5" fill="#5B4B7A" /><ellipse cx="114" cy="129" rx="13" ry="7" fill="#5B4B7A" /></g>
        <g className="bob">
          <circle cx="64" cy="94" r="10" fill="#FFF4E4" />
          <circle cx="78" cy="38" r="12" fill="#FF8F7A" /><circle cx="118" cy="34" r="12" fill="#FF8F7A" />
          <ellipse cx="100" cy="76" rx="38" ry="42" fill="#FF8F7A" />
          <ellipse cx="110" cy="84" rx="22" ry="26" fill="#FFF4E4" />
          <path d="M66 58q34 14 70-2l2 11q-38 16-74 2z" fill="#C9B8F5" />
          <path d="M68 62l-22 6 3 9 22-6z" fill="#C9B8F5" />
          <path d="M100 34V20" stroke="#6FBF95" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="90" cy="16" rx="12" ry="5" fill="#8FDDB8" transform="rotate(-24 90 16)" />
          <ellipse cx="110" cy="16" rx="12" ry="5" fill="#8FDDB8" transform="rotate(24 110 16)" />
          <circle cx="116" cy="62" r="5.5" fill="#3B2A4A" /><circle cx="118" cy="60" r="1.8" fill="#FFF4E4" />
          <ellipse cx="124" cy="74" rx="6" ry="4" fill="#FFB7B0" />
          <circle cx="134" cy="88" r="9" fill="#F2755F" />
        </g>
      </svg>
      <div className="track" />
    </div>
  );
}

export function Welcome({ onPlay, onDemo, notice, busy }: { onPlay(): void; onDemo(): void; notice: string; busy: boolean }) {
  const qr = useQr();
  const [n, d] = qr ? qr.split('|') : ['0', ''];
  return (
    <main className="welcome">
      <Mascot />
      <div className="welcome-copy">
        <h1>REALITY<br />RUN</h1>
        <p className="subtitle">Your world is the obstacle course.</p>
        <button className="cta" onClick={onPlay} disabled={busy}>Let’s Play</button>
        {notice && (
          <div className="notice" role="alert">
            <p>{notice}</p>
            <button className="link" onClick={onDemo}>Play the demo world</button>
          </div>
        )}
        {qr && (
          <div className="qr">
            <svg viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="QR code for this page"><path fill="#3B2A4A" d={d} /></svg>
            <span>On a computer? Scan this with your phone to play there.</span>
          </div>
        )}
      </div>
    </main>
  );
}
