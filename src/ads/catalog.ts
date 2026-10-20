// Sarvimo house ads. Videos stream straight from sarvimo.com; every click lands on the matching page.

const UTM = 'utm_source=ludonova&utm_medium=';
export const withUtm = (href: string, medium: string) => `${href}${href.includes('?') ? '&' : '?'}${UTM}${medium}`;

export interface VideoAd { src: string; poster: string; href: string; product: string; line: string }
export interface BannerAd { href: string; product: string; title: string; sub: string; cta: string; accent: string }

const S = 'https://sarvimo.com';

export const VIDEOS: VideoAd[] = [
  { src: `${S}/video/sarvimo-film.mp4`, poster: `${S}/video/sarvimo-film-poster.webp`, href: S, product: 'Sarvimo', line: 'Every everyday tool, one place. Built for India.' },
  { src: `${S}/khata/video/khata-film.mp4`, poster: `${S}/khata/video/khata-film-poster.webp`, href: `${S}/khata`, product: 'Sarvimo Khata', line: 'Track expenses & salary, split costs with family.' },
  { src: `${S}/khata/video/munshi-film.mp4`, poster: `${S}/khata/video/munshi-film-poster.webp`, href: `${S}/khata`, product: 'Sarvimo Khata', line: 'Your pocket munshi for every rupee.' },
  { src: `${S}/khata/video/khata-demo.mp4`, poster: `${S}/khata/video/khata-demo-poster.webp`, href: `${S}/khata`, product: 'Sarvimo Khata', line: 'See where your money goes. Install on your phone.' },
  { src: `${S}/hisaab/video/hisaab-film.mp4`, poster: `${S}/hisaab/video/hisaab-film-poster.webp`, href: `${S}/hisaab`, product: 'Sarvimo Hisaab', line: 'Get paid on time: reminders with UPI links.' },
  { src: `${S}/hisaab/video/hisaab-demo.mp4`, poster: `${S}/hisaab/video/hisaab-demo-poster.webp`, href: `${S}/hisaab`, product: 'Sarvimo Hisaab', line: 'Invoices, receipts and polite WhatsApp nudges.' },
];

export const BANNERS: BannerAd[] = [
  { href: S, product: 'Sarvimo', title: 'Every everyday tool, one place', sub: 'PDFs, forms, bookings, calculators — one free account', cta: 'Explore', accent: '#2b7bff' },
  { href: `${S}/khata`, product: 'Sarvimo Khata', title: 'Where did your salary go?', sub: 'Track expenses in ₹ & split costs with family', cta: 'Try Khata', accent: '#00c97a' },
  { href: `${S}/hisaab`, product: 'Sarvimo Hisaab', title: 'Get paid on time', sub: 'WhatsApp reminders with UPI pay links', cta: 'Join waitlist', accent: '#ff8c42' },
  { href: `${S}/resume-maker`, product: 'Resume Maker', title: 'ATS-ready resume in minutes', sub: 'Free, no sign-up, download as PDF', cta: 'Make resume', accent: '#9b6bff' },
  { href: `${S}/payslip-maker`, product: 'Payslip Maker', title: 'Salary slips with PF, ESI, TDS', sub: 'Free payslip generator, PDF in seconds', cta: 'Make payslip', accent: '#ff2d55' },
  { href: `${S}/hr-letters`, product: 'HR Letters', title: 'Offer & experience letters', sub: 'Ready wording, your logo, saved as PDF', cta: 'Create letter', accent: '#ffb400' },
  { href: `${S}/calculators`, product: 'Money Calculators', title: 'EMI, SIP, FD, GST in one tap', sub: 'Instant answers, no sign-up', cta: 'Calculate', accent: '#2ee5c5' },
];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// The always-on banner changes on every page load (picked once per load).
export const PAGE_BANNER = pick(BANNERS);
export const randomVideo = () => pick(VIDEOS);
export const randomBanner = () => pick(BANNERS);

export const SKIP_AFTER_S = 37;

export const openAd = (href: string, medium: string) => window.open(withUtm(href, medium), '_blank', 'noopener');
