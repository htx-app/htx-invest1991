/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a number as Mozambican Metical (MZN)
 */
export function fmt(n: number): string {
  return (Number(n) || 0).toLocaleString('pt-MZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Validates Mozambican phone numbers starting with 8[2-7] with exactly 9 digits
 */
export function validatePhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^8[2-7]\d{7}$/.test(clean);
}

/**
 * Validates password format (minimum 6 characters)
 */
export function validatePassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Validates username (minimum 2 characters)
 */
export function validateName(name: string): boolean {
  return name.trim().length >= 2;
}

/**
 * Generates a simple 6-character referral code
 */
export function generateRefCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Securely hashes passwords using SHA-256 via browser subtle crypto
 */
export async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Safely escape characters for standard HTML outputs
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates lightweight UUID-like identifiers
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
