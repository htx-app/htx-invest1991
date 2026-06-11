/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, VIPPlan, PlatformConfig, AuditLog, Admin } from './types';
import { DEFAULT_VIP_PLANS, DEFAULT_PLATFORM_CONFIG } from './data';
import { generateRefCode, generateUUID, hashPassword } from './utils';

const KEY_CONFIG = 'htx_platform_config';
const KEY_VIP_PLANS = 'htx_vip_plans';
const KEY_AUDIT_LOGS = 'htx_audit_logs';
const KEY_ADMINS = 'htx_admins';
const KEY_USER_PHONES = 'htx_user_phones';

export class PersistenceManager {
  /**
   * Safe JSON parse with fallback
   */
  private static safeParse<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Safe JSON stringify
   */
  private static safeSave<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving key ${key}`, e);
    }
  }

  /**
   * Initialize defaults if they do not yet exist
   */
  public static async initialize(): Promise<void> {
    // Platform Config
    if (!localStorage.getItem(KEY_CONFIG)) {
      this.safeSave(KEY_CONFIG, DEFAULT_PLATFORM_CONFIG);
    }

    // VIP Plans
    const storedPlans = localStorage.getItem(KEY_VIP_PLANS);
    if (!storedPlans) {
      this.safeSave(KEY_VIP_PLANS, DEFAULT_VIP_PLANS);
    } else {
      try {
        const parsed: VIPPlan[] = JSON.parse(storedPlans);
        let updated = false;
        parsed.forEach((storedPlan) => {
          const defaultPlan = DEFAULT_VIP_PLANS.find((dp) => dp.level === storedPlan.level);
          if (defaultPlan) {
            const isOldUnsplash = 
              storedPlan.image.includes('photo-1596462502278-27bfdc403348') ||
              storedPlan.image.includes('photo-1590735213920-68192a487bc2') ||
              storedPlan.image.includes('photo-1556909114-f6e7ad7d3136') ||
              storedPlan.image.includes('photo-1522337360788-8b13dee7a37e') ||
              storedPlan.image.includes('photo-1511707171634-5f897ff02aa9') ||
              storedPlan.image.includes('photo-1571175443880-49e1d25b2bc5') ||
              storedPlan.image.includes('photo-1593359677879-a4bb92f4834a') ||
              storedPlan.image.includes('photo-1552519507-da3b142c6e3d');
            if (isOldUnsplash) {
              storedPlan.image = defaultPlan.image;
              updated = true;
            }
          }
        });
        if (updated) {
          this.safeSave(KEY_VIP_PLANS, parsed);
        }
      } catch {
        this.safeSave(KEY_VIP_PLANS, DEFAULT_VIP_PLANS);
      }
    }

    // Audit logs
    if (!localStorage.getItem(KEY_AUDIT_LOGS)) {
      this.safeSave(KEY_AUDIT_LOGS, []);
    }

    // Registered user phones tracker
    if (!localStorage.getItem(KEY_USER_PHONES)) {
      this.safeSave(KEY_USER_PHONES, []);
    }

    // Seed default admin
    const admins = this.safeParse<Admin[]>(KEY_ADMINS, []);
    if (admins.length === 0) {
      const defaultHash = await hashPassword('HTX@admin2024');
      const superAdmin: Admin = {
        id: generateUUID(),
        name: 'Super Administrador',
        phone: '872344381',
        passwordHash: defaultHash,
        role: 'super',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      admins.push(superAdmin);
      this.safeSave(KEY_ADMINS, admins);

      // Log seed
      this.writeAuditLog(null, null, 'system_seed_admin', {
        phone: '872344381',
      });
    }
  }

  // --- PLATFORM CONFIG ---
  public static getConfig(): PlatformConfig {
    return this.safeParse<PlatformConfig>(KEY_CONFIG, DEFAULT_PLATFORM_CONFIG);
  }

  public static saveConfig(config: PlatformConfig): void {
    this.safeSave(KEY_CONFIG, config);
  }

  // --- VIP PLANS ---
  public static getVIPPlans(): VIPPlan[] {
    return this.safeParse<VIPPlan[]>(KEY_VIP_PLANS, DEFAULT_VIP_PLANS);
  }

  public static saveVIPPlans(plans: VIPPlan[]): void {
    this.safeSave(KEY_VIP_PLANS, plans);
  }

  // --- AUDIT LOGS ---
  public static getAuditLogs(): AuditLog[] {
    return this.safeParse<AuditLog[]>(KEY_AUDIT_LOGS, []);
  }

  public static writeAuditLog(
    adminId: string | null,
    userId: string | null,
    action: string,
    details: any
  ): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: generateUUID(),
      adminId,
      userId,
      action,
      details,
      createdAt: new Date().toISOString(),
    };
    logs.unshift(newLog); // Newest first

    // Limit log size to prevent filling storage
    if (logs.length > 500) {
      logs.splice(500);
    }
    this.safeSave(KEY_AUDIT_LOGS, logs);
  }

  // --- ADMINS ---
  public static getAdmins(): Admin[] {
    return this.safeParse<Admin[]>(KEY_ADMINS, []);
  }

  public static saveAdmins(admins: Admin[]): void {
    this.safeSave(KEY_ADMINS, admins);
  }

  // --- USERS ---
  public static getUserPhones(): string[] {
    return this.safeParse<string[]>(KEY_USER_PHONES, []);
  }

  public static getUserByPhone(phone: string): User | null {
    const cleanPhone = phone.replace(/\D/g, '');
    const userKey = `htx_user_${cleanPhone}`;
    return this.safeParse<User | null>(userKey, null);
  }

  public static saveUser(user: User): void {
    const cleanPhone = user.phone.replace(/\D/g, '');
    const userKey = `htx_user_${cleanPhone}`;
    
    // Track registered index
    const phones = this.getUserPhones();
    if (!phones.includes(cleanPhone)) {
      phones.push(cleanPhone);
      this.safeSave(KEY_USER_PHONES, phones);
    }
    
    user.updatedAt = new Date().toISOString();
    this.safeSave(userKey, user);
  }

  public static getAllUsers(): User[] {
    const phones = this.getUserPhones();
    return phones
      .map((phone) => this.getUserByPhone(phone))
      .filter((u): u is User => u !== null);
  }

  public static deleteUser(phone: string): void {
    const cleanPhone = phone.replace(/\D/g, '');
    const userKey = `htx_user_${cleanPhone}`;
    localStorage.removeItem(userKey);

    const phones = this.getUserPhones();
    const index = phones.indexOf(cleanPhone);
    if (index > -1) {
      phones.splice(index, 1);
      this.safeSave(KEY_USER_PHONES, phones);
    }
  }

  // --- SYSTEM FACTORY RESET ---
  public static selfDestruct(): void {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((key) => {
      if (key.startsWith('htx_')) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.clear();
  }
}
