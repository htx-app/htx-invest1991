/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TeamMember {
  phone: string;
  name: string;
  joinedAt: string;
  firstDepositAt: string | null;
}

export interface Transaction {
  id: string;
  type: 'recharge' | 'withdraw' | 'profit' | 'bonus' | 'adjust';
  desc: string;
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  date: string;
  payoutPhone?: string;
  proofUrl?: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  passwordHash: string;
  balance: number;
  rechargeTotal: number;
  vipLevel: number;
  totalProfit: number;
  referralCode: string;
  referredBy: string;
  firstDepositDone: boolean;
  team: TeamMember[];
  transactions: Transaction[];
  createdAt: string;
  updatedAt: string;
  isBlocked: boolean;
  vipActivatedAt: string | null;
  lastWithdrawTs: string | null;
  lastCollectDate: string | null;
  customDailyProfit?: number | null;
}

export interface VIPPlan {
  level: number;
  name: string;
  dailyProfit: number;
  unlockCost: number;
  emoji: string;
  days: number;
  rate: string;
  color: string;
  image: string;
}

export interface PlatformConfig {
  withdrawHourStart: number;
  withdrawHourEnd: number;
  withdrawDiscountPct: number;
  emolaNumber: string;
  emolaName: string;
  whatsappNumber: string;
  telegramLink: string;
}

export interface AuditLog {
  id: string;
  adminId: string | null;
  userId: string | null;
  action: string;
  details: any;
  createdAt: string;
}

export interface Admin {
  id: string;
  name: string;
  phone: string;
  passwordHash: string;
  role: 'super' | 'admin';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}
