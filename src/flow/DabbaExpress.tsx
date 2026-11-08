import FlowTycoon, { type FlowConfig } from './FlowTycoon';
const cfg: FlowConfig = {
  slug: 'dabbaexpress', name: 'Dabba Express', accent: 'linear-gradient(135deg,#2f7bff,#ffd23f)', tag: 'Tiffin delivery tycoon', logo: '🍱',
  intro: [
    { icon: '🏠', text: 'Dabbas leave homes, get picked up by cycle, sorted at the station, ride the local and reach offices.' },
    { icon: '⏳', text: 'Every dabba shows a timer at each stage. If it waits too long, lunch is late and your rating drops.' },
    { icon: '⬆️', text: 'Tap a stage: hire more dabbawalas, move faster, or earn more per dabba. Unlock a second train and runners.' },
  ],
  source: { name: 'Homes', icon: '🏠', base: 140, rate: 2.6, text: 'Sign up more homes in the colony.' },
  stages: [
    { key: 'cycle', name: 'Cycle pickup', icon: '🚲', base: 80, svc: 3, fee: 3, per: 2, maxN: 5, unlock: 0, color: '#ffd23f', add: 'Hire a cyclist', spd: 'Better cycles', inc: 'Premium homes', text: 'Collect dabbas from homes. Each cyclist carries two.' },
    { key: 'sort', name: 'Sorting', icon: '🔤', base: 120, svc: 2.5, fee: 4, per: 1, maxN: 5, unlock: 0, color: '#ff8c42', add: 'More sorters', spd: 'Colour codes', inc: 'Express sorting', text: 'Read the code on the lid and group dabbas by area.' },
    { key: 'train', name: 'Local train', icon: '🚆', base: 300, svc: 7, fee: 10, per: 6, maxN: 3, unlock: 0, color: '#2f7bff', add: 'Another coach', spd: 'Fast local', inc: 'Luggage pass', text: 'One coach carries six dabbas across the city at once.' },
    { key: 'runner', name: 'Runners', icon: '🏃', base: 200, svc: 3.5, fee: 6, per: 2, maxN: 5, unlock: 40, optional: true, color: '#ff5e7e', add: 'Hire a runner', spd: 'Shortcuts', inc: 'Tip from offices', text: 'Carry dabbas from the station to each office on foot.' },
    { key: 'office', name: 'Office desk', icon: '🏢', base: 250, svc: 1.8, fee: 5, per: 1, maxN: 4, unlock: 0, color: '#00c97a', add: 'New office tower', spd: 'Lift access', inc: 'Corporate deal', text: 'Hand over the dabba. Lunch delivered, money earned.' },
  ],
  entity: 'box', colors: ['#e5304f', '#2f7bff', '#00a35c', '#ff8c42', '#7d5cff'], floor: ['#dbe7f3', '#c5d6e8'], unitLabel: 'dabbas delivered', patience: 35, finalFee: 3,
  levels: [[0, 'One-cycle startup'], [60, 'Colony favourite'], [250, 'Station network'], [800, 'City-wide'], [2500, 'Dabba empire']],
};
export default function DabbaExpress() { return <FlowTycoon cfg={cfg} />; }
