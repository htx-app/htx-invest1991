/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VIPPlan, PlatformConfig } from './types';
import vipCremeImg from './assets/images/vip_creme_1781171380953.png';
import vipCapulanaImg from './assets/images/vip_capulana_1781171394896.png';
import vipCelularImg from './assets/images/vip_celular_1781171411114.png';
import vipCarroImg from './assets/images/vip_carro_1781171425925.png';

export const DEFAULT_VIP_PLANS: VIPPlan[] = [
  {
    level: 0,
    name: 'Starter (Padrão)',
    dailyProfit: 0,
    unlockCost: 0,
    emoji: '🔒',
    days: 0,
    rate: '0%',
    color: '#64748b',
    image: '',
  },
  {
    level: 1,
    name: 'Creme Clarificante',
    dailyProfit: 65,
    unlockCost: 650,
    emoji: '🧴',
    days: 30,
    rate: '10%/dia',
    color: '#ec4899',
    image: vipCremeImg,
  },
  {
    level: 2,
    name: 'Capulana Premium',
    dailyProfit: 130,
    unlockCost: 1300,
    emoji: '👗',
    days: 30,
    rate: '10%/dia',
    color: '#f59e0b',
    image: vipCapulanaImg,
  },
  {
    level: 3,
    name: 'Fogão a Gás',
    dailyProfit: 260,
    unlockCost: 2600,
    emoji: '🍳',
    days: 30,
    rate: '10%/dia',
    color: '#f97316',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&q=80',
  },
  {
    level: 4,
    name: 'Kit Beleza',
    dailyProfit: 500,
    unlockCost: 5000,
    emoji: '💄',
    days: 30,
    rate: '10%/dia',
    color: '#a855f7',
    image: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=600&q=80',
  },
  {
    level: 5,
    name: 'Smartphone Pro',
    dailyProfit: 1000,
    unlockCost: 10000,
    emoji: '📱',
    days: 30,
    rate: '10%/dia',
    color: '#3b82f6',
    image: vipCelularImg,
  },
  {
    level: 6,
    name: 'Frigorífico Smart',
    dailyProfit: 2000,
    unlockCost: 20000,
    emoji: '❄️',
    days: 30,
    rate: '10%/dia',
    color: '#06b6d4',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&q=80',
  },
  {
    level: 7,
    name: 'TV Smart Ultra 4K',
    dailyProfit: 5000,
    unlockCost: 50000,
    emoji: '📺',
    days: 30,
    rate: '10%/dia',
    color: '#8b5cf6',
    image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80',
  },
  {
    level: 8,
    name: 'Automóvel Citadino',
    dailyProfit: 10000,
    unlockCost: 100000,
    emoji: '🚗',
    days: 30,
    rate: '10%/dia',
    color: '#10b981',
    image: vipCarroImg,
  },
];

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  withdrawHourStart: 9,
  withdrawHourEnd: 17,
  withdrawDiscountPct: 10,
  emolaNumber: '867090687',
  emolaName: 'Aninha Basto',
  whatsappNumber: '258840000000',
  telegramLink: 'https://t.me/HTXInvestMZ',
};
