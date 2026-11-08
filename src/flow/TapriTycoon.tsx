import FlowTycoon, { type FlowConfig } from './FlowTycoon';
const cfg: FlowConfig = {
  slug: 'tapritycoon', name: 'Tapri Tycoon', accent: 'linear-gradient(135deg,#a0522d,#ffb347)', tag: 'Chai stall to café chain', logo: '☕',
  intro: [
    { icon: '🚶', text: 'Customers walk up to your tapri, queue, order, wait for chai and pay at every stage.' },
    { icon: '⏳', text: 'Every customer shows a timer while being served. Wait too long and they leave angry.' },
    { icon: '⬆️', text: 'Tap a stage: add more counters, serve faster or earn more. Unlock snacks, seating and Wi-Fi.' },
  ],
  source: { name: 'Gali', icon: '🚶', base: 120, rate: 3.2, text: 'Put up a bigger signboard so more people walk in.' },
  stages: [
    { key: 'order', name: 'Counter', icon: '🧾', base: 80, svc: 2.5, fee: 3, per: 1, maxN: 4, unlock: 0, color: '#ffd23f', add: 'Extra counter', spd: 'Quicker orders', inc: 'Bigger menu', text: 'Take orders. More counters, shorter queues.' },
    { key: 'chai', name: 'Chai stove', icon: '🫖', base: 100, svc: 4.5, fee: 8, per: 2, maxN: 5, unlock: 0, color: '#ff8c42', add: 'Extra stove', spd: 'Stronger flame', inc: 'Masala & kulhad', text: 'Brew the chai. Each stove makes two cups at a time.' },
    { key: 'snack', name: 'Snacks', icon: '🥟', base: 260, svc: 3.5, fee: 12, per: 1, maxN: 4, unlock: 25, optional: true, color: '#ff5e7e', add: 'Extra kadhai', spd: 'Hotter oil', inc: 'Samosa to vada pav', text: 'Bun maska, samosa, vada pav. Big money per plate.' },
    { key: 'seat', name: 'Benches', icon: '🪑', base: 420, svc: 6, fee: 10, per: 3, maxN: 4, unlock: 70, optional: true, color: '#7d5cff', add: 'More benches', spd: 'Fast table clearing', inc: 'Fans and Wi-Fi', text: 'Let people sit and chat. They spend while they sit.' },
    { key: 'pay', name: 'Galla', icon: '💵', base: 150, svc: 1.6, fee: 2, per: 1, maxN: 3, unlock: 0, color: '#00c97a', add: 'UPI QR', spd: 'Tap to pay', inc: 'Loyalty card', text: 'Collect the money. Everyone pays here before leaving.' },
  ],
  entity: 'person', colors: ['#e5304f', '#2f7bff', '#00a35c', '#ff8c42', '#7d5cff', '#1b1035'], floor: ['#f7e3c3', '#e9c99a'], unitLabel: 'cups served', patience: 40, finalFee: 2,
  levels: [[0, 'Gali ki tapri'], [60, 'Famous tapri'], [250, 'Chai point'], [800, 'Café'], [2500, 'Café chain']],
};
export default function TapriTycoon() { return <FlowTycoon cfg={cfg} />; }
