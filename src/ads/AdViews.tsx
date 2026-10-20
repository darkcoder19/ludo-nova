import { useEffect, useRef, useState } from 'react';
import { PremiumButton } from '../account/AccountViews';
import { openAd, PAGE_BANNER, randomBanner, randomVideo, SKIP_AFTER_S, type BannerAd, type VideoAd } from './catalog';

/** Thin always-on banner. It sits in the page flow, so it never covers the board. */
export function BannerStrip({ ad = PAGE_BANNER }: { ad?: BannerAd }) {
  return (
    <a className="ad-strip" style={{ ['--ac' as string]: ad.accent }} href="#" onClick={(e) => { e.preventDefault(); openAd(ad.href, 'banner'); }}>
      <img src="/sarvimo-icon.png" alt="" />
      <span className="ad-txt"><b>{ad.title}</b><small>{ad.product} · {ad.sub}</small></span>
      <span className="ad-cta">{ad.cta} ›</span>
      <i className="ad-tag">Ad</i>
    </a>
  );
}

export type Interstitial = { kind: 'video'; ad: VideoAd } | { kind: 'banner'; ad: BannerAd };
export const randomInterstitial = (): Interstitial =>
  Math.random() < 0.65 ? { kind: 'video', ad: randomVideo() } : { kind: 'banner', ad: randomBanner() };

/** Full-screen ad shown before an action. Skip button unlocks after 37s for video, 5s for a banner. */
export function InterstitialAd({ ad, onDone }: { ad: Interstitial; onDone(): void }) {
  const wait = ad.kind === 'video' ? SKIP_AFTER_S : 5;
  const [left, setLeft] = useState(wait);
  const [muted, setMuted] = useState(true);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // The ad only closes when the player presses Skip; the video loops until then.
  const canSkip = left === 0;
  const href = ad.ad.href;
  const visit = () => openAd(href, ad.kind === 'video' ? 'video' : 'popup');

  return (
    <div className="ad-ov">
      <div className="ad-card">
        <div className="ad-head">
          <img src="/sarvimo-icon.png" alt="" />
          <b>{ad.ad.product}</b>
          <i className="ad-tag">Ad</i>
          <button className={`ad-skip ${canSkip ? 'on' : ''}`} disabled={!canSkip} onClick={onDone}>
            {canSkip ? 'Skip ad ✕' : `Skip in ${left}s`}
          </button>
        </div>

        {ad.kind === 'video' ? (
          <div className="ad-video" onClick={visit}>
            <video ref={video} src={ad.ad.src} poster={ad.ad.poster} autoPlay loop muted={muted} playsInline
              onError={() => setLeft(0)} />
            <button className="ad-mute" onClick={(e) => { e.stopPropagation(); setMuted(!muted); if (video.current) video.current.muted = !muted; }}>
              {muted ? '🔇 Tap for sound' : '🔊'}
            </button>
          </div>
        ) : (
          <div className="ad-poster" style={{ ['--ac' as string]: ad.ad.accent }} onClick={visit}>
            <img src="/sarvimo-icon.png" alt="" />
            <h3>{ad.ad.title}</h3>
            <p>{ad.ad.sub}</p>
          </div>
        )}

        <div className="ad-foot">
          <span>{ad.kind === 'video' ? ad.ad.line : `${ad.ad.product} · sarvimo.com`}</span>
          <button className="btn primary sm" onClick={visit}>{ad.kind === 'banner' ? ad.ad.cta : 'Visit'} ↗</button>
        </div>
        <div className="ad-upsell"><span>Tired of ads?</span><PremiumButton /></div>
        {!canSkip && <div className="ad-progress"><i style={{ width: `${((wait - left) / wait) * 100}%` }} /></div>}
      </div>
    </div>
  );
}
