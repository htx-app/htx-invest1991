/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { 
  X, BarChart2, ShieldAlert, CreditCard, Download, Users, Sliders, Settings, 
  Check, AlertTriangle, Play, Undo, Trash2, Ban, Lock, Save, Plus, ArrowUpRight, Search, 
  User as UserIcon, Calendar, Percent, RefreshCw, Key, ShieldCheck
} from 'lucide-react';
import { Admin, User, AuditLog, PlatformConfig, VIPPlan, Transaction } from '../types';
import { PersistenceManager } from '../db';
import { fmt, hashPassword, generateUUID } from '../utils';

interface AdminPanelProps {
  currentAdmin: Admin;
  onClose: () => void;
  toast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onUpdatePlatform: () => void;
}

export default function AdminPanel({ currentAdmin, onClose, toast, onUpdatePlatform }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'recharges' | 'withdrawals' | 'users' | 'userDetail' | 'config' | 'audit' | 'admins'>('dashboard');
  
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(PersistenceManager.getConfig());
  const [vipPlans, setVipPlans] = useState<VIPPlan[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserPhone, setSelectedUserPhone] = useState<string | null>(null);

  // User details editor states
  const [customProfitInput, setCustomProfitInput] = useState('');
  const [adjustBalanceInput, setAdjustBalanceInput] = useState('');
  const [adjustBalanceType, setAdjustBalanceType] = useState<'add' | 'remove'>('add');
  const [editName, setEditName] = useState('');
  const [editPass, setEditPass] = useState('');

  // Config parameters states
  const [cfgStartHour, setCfgStartHour] = useState(0);
  const [cfgEndHour, setCfgEndHour] = useState(0);
  const [cfgTax, setCfgTax] = useState(0);
  const [cfgEmolaNo, setCfgEmolaNo] = useState('');
  const [cfgEmolaName, setCfgEmolaName] = useState('');
  const [cfgWaNo, setCfgWaNo] = useState('');
  const [cfgTg, setCfgTg] = useState('');

  // Create Admin states
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');

  // Super Admin Control states
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserBalance, setNewUserBalance] = useState('0');
  const [newUserVip, setNewUserVip] = useState(0);

  // Manual Transaction states
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxType, setNewTxType] = useState<'recharge' | 'withdraw' | 'profit' | 'bonus' | 'adjust'>('adjust');
  const [newTxStatus, setNewTxStatus] = useState<'pending' | 'completed' | 'rejected'>('completed');

  // Dynamic VIP Plan states
  const [showCreateVipForm, setShowCreateVipForm] = useState(false);
  const [newVipLevel, setNewVipLevel] = useState<number>(0);
  const [newVipName, setNewVipName] = useState('');
  const [newVipCost, setNewVipCost] = useState<number>(0);
  const [newVipProfit, setNewVipProfit] = useState<number>(0);
  const [newVipDays, setNewVipDays] = useState<number>(30);
  const [newVipEmoji, setNewVipEmoji] = useState('💎');
  const [newVipImage, setNewVipImage] = useState('');

  // Super Admin functions
  const handleCreateUserManual = async (e: FormEvent) => {
    e.preventDefault();
    const cleanPhone = newUserPhone.replace(/\D/g, '');
    if (!newUserName.trim() || cleanPhone.length < 9 || !newUserPass.trim()) {
      toast('Por favor, preencha todos os campos do utilizador.', 'error');
      return;
    }

    if (PersistenceManager.getUserByPhone(cleanPhone)) {
      toast('Já existe um utilizador registado com esse número de telefone.', 'error');
      return;
    }

    const pwHash = await hashPassword(newUserPass);
    const referralCode = 'REF' + Math.floor(100000 + Math.random() * 900000);

    const initialBal = parseFloat(newUserBalance) || 0;

    const newUserObj: User = {
      id: generateUUID(),
      name: newUserName.trim(),
      phone: cleanPhone,
      passwordHash: pwHash,
      balance: initialBal,
      rechargeTotal: initialBal,
      vipLevel: newUserVip,
      totalProfit: 0,
      referralCode,
      referredBy: '',
      firstDepositDone: initialBal > 0,
      team: [],
      transactions: initialBal > 0 ? [{
        id: generateUUID(),
        type: 'adjust',
        desc: 'Saldo inicial creditado pelo Super Administrador',
        amount: initialBal,
        status: 'completed',
        date: new Date().toISOString()
      }] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isBlocked: false,
      vipActivatedAt: newUserVip > 0 ? new Date().toISOString() : null,
      lastWithdrawTs: null,
      lastCollectDate: null
    };

    PersistenceManager.saveUser(newUserObj);
    PersistenceManager.writeAuditLog(currentAdmin.id, newUserObj.id, 'admin_create_user_manual', {
      name: newUserObj.name,
      phone: newUserObj.phone,
      balance: newUserObj.balance,
      vipLevel: newUserObj.vipLevel
    });

    toast(`Utilizador ${newUserObj.name} criado manualmente no sistema!`, 'success');
    
    // Clear states
    setNewUserName('');
    setNewUserPhone('');
    setNewUserPass('');
    setNewUserBalance('0');
    setNewUserVip(0);
    setShowCreateUserModal(false);
    reloadData();
    onUpdatePlatform();
  };

  const handleDeleteUserManual = (phone: string) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    const conf = confirm(`ATENÇÃO CRÍTICA: Deseja REALMENTE excluir permanentemente o utilizador ${user.name} (+258 ${user.phone})?\nEsta ação é irreversível e apagará todo o saldo e históricos dele do sistema!`);
    if (!conf) return;

    PersistenceManager.deleteUser(phone);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'admin_delete_user_permanent', {
      name: user.name,
      phone: user.phone
    });

    toast(`O utilizador ${user.name} foi apagado do sistema permanentemente!`, 'success');
    setSelectedUserPhone(null);
    setActiveTab('users');
    reloadData();
    onUpdatePlatform();
  };

  const handleAddTransactionManual = (phone: string) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    if (!newTxDesc.trim() || isNaN(parseFloat(newTxAmount))) {
      toast('Descrição e montante são obrigatórios.', 'error');
      return;
    }

    const tAmount = parseFloat(newTxAmount);
    
    const newTx: Transaction = {
      id: generateUUID(),
      type: newTxType,
      desc: newTxDesc.trim(),
      amount: tAmount,
      status: newTxStatus,
      date: new Date().toISOString()
    };

    if (!user.transactions) {
      user.transactions = [];
    }

    user.transactions.push(newTx);

    if (newTxStatus === 'completed') {
      user.balance += tAmount;
      if (newTxType === 'recharge') {
        user.rechargeTotal = (user.rechargeTotal || 0) + tAmount;
      } else if (newTxType === 'profit') {
        user.totalProfit += tAmount;
      }
    }

    PersistenceManager.saveUser(user);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'admin_add_transaction_manual', {
      txDesc: newTxDesc,
      txAmount: tAmount,
      txType: newTxType,
      txStatus: newTxStatus
    });

    toast(`Transação manual lançada para o utilizador com sucesso!`, 'success');
    setNewTxDesc('');
    setNewTxAmount('');
    reloadData();
    onUpdatePlatform();
  };

  const handleDeleteTransaction = (phone: string, txId: string) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    const txIndex = user.transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return;

    const tx = user.transactions[txIndex];
    const conf = confirm(`Deseja realmente apagar a transação "${tx.desc}" (MZN ${fmt(tx.amount)})?\nNota: O saldo dele não será estornado automaticamente. Se houver divergência, acerte o saldo dele manualmente.`);
    if (!conf) return;

    user.transactions.splice(txIndex, 1);
    PersistenceManager.saveUser(user);

    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'admin_delete_transaction', {
      txId,
      txDesc: tx.desc,
      txAmount: tx.amount
    });

    toast('Transação removida com êxito.', 'info');
    reloadData();
    onUpdatePlatform();
  };

  const handleAddNewVipPlan = (e: FormEvent) => {
    e.preventDefault();
    if (newVipLevel <= 0 || !newVipName.trim() || newVipCost <= 0 || newVipProfit <= 0) {
      toast('Preencha os dados obrigatórios do plano VIP.', 'error');
      return;
    }

    const currentPlans = PersistenceManager.getVIPPlans();
    if (currentPlans.some((p) => p.level === newVipLevel)) {
      toast(`Já existe um de nível ${newVipLevel}.`, 'error');
      return;
    }

    const newPlan: VIPPlan = {
      level: newVipLevel,
      name: newVipName.trim(),
      dailyProfit: newVipProfit,
      unlockCost: newVipCost,
      emoji: newVipEmoji.trim() || '💎',
      days: newVipDays,
      rate: `${((newVipProfit / newVipCost) * 100).toFixed(1)}%/dia`,
      color: '#c5a880',
      image: newVipImage.trim() || 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80'
    };

    const updatedPlans = [...currentPlans, newPlan].sort((a,b) => a.level - b.level);
    PersistenceManager.saveVIPPlans(updatedPlans);
    PersistenceManager.writeAuditLog(currentAdmin.id, null, 'admin_add_new_vip_plan', {
      level: newVipLevel,
      name: newVipName,
      cost: newVipCost,
      profit: newVipProfit
    });

    toast(`Novo plano VIP ${newVipName} (Nível ${newVipLevel}) inaugurado com sucesso!`, 'success');
    setNewVipLevel(0);
    setNewVipName('');
    setNewVipCost(0);
    setNewVipProfit(0);
    setNewVipDays(30);
    setNewVipEmoji('💎');
    setNewVipImage('');
    setShowCreateVipForm(false);
    reloadData();
    onUpdatePlatform();
  };

  const handleDeleteVipPlan = (level: number) => {
    if (level === 0) {
      toast('Não é possível apagar a base free (Nível 0).', 'error');
      return;
    }

    const conf = confirm(`Tem certeza que quer DELETAR o plano VIP Nível ${level} permanently?\nClientes mantidos nesse nível não serão afetados, mas sairá da listagem de compras.`);
    if (!conf) return;

    let currentPlans = PersistenceManager.getVIPPlans();
    currentPlans = currentPlans.filter((p) => p.level !== level);
    PersistenceManager.saveVIPPlans(currentPlans);

    PersistenceManager.writeAuditLog(currentAdmin.id, null, 'admin_delete_vip_plan', { level });
    toast(`Plano VIP Nível ${level} deletado com êxito.`, 'info');
    reloadData();
    onUpdatePlatform();
  };

  // Reload everything from local DB context
  const reloadData = () => {
    setUsers(PersistenceManager.getAllUsers());
    setAuditLogs(PersistenceManager.getAuditLogs());
    setAdmins(PersistenceManager.getAdmins());
    setPlatformConfig(PersistenceManager.getConfig());
    setVipPlans(PersistenceManager.getVIPPlans());
  };

  useEffect(() => {
    reloadData();

    // Seed variables on startup
    const cfg = PersistenceManager.getConfig();
    setCfgStartHour(cfg.withdrawHourStart);
    setCfgEndHour(cfg.withdrawHourEnd);
    setCfgTax(cfg.withdrawDiscountPct);
    setCfgEmolaNo(cfg.emolaNumber);
    setCfgEmolaName(cfg.emolaName);
    setCfgWaNo(cfg.whatsappNumber);
    setCfgTg(cfg.telegramLink || '');
  }, []);

  const handleApproveRecharge = (userPhone: string, txId: string) => {
    const user = PersistenceManager.getUserByPhone(userPhone);
    if (!user) {
      toast('Utilizador não encontrado.', 'error');
      return;
    }

    const tx = user.transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== 'pending') {
      toast('Transação não encontrada ou já resolvida.', 'error');
      return;
    }

    // Process recharge
    const rechargeAmount = tx.amount;
    const isFirstDeposit = !user.firstDepositDone;

    user.balance += rechargeAmount;
    user.rechargeTotal += rechargeAmount;
    tx.status = 'completed';

    // Audit logs tracking
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'approve_recharge', {
      amount: rechargeAmount,
      txId,
      userPhone,
    });

    // If first deposit, trigger referral reward (10%)
    if (isFirstDeposit) {
      user.firstDepositDone = true;
      if (user.referredBy) {
        const referrer = PersistenceManager.getAllUsers().find((u) => u.referralCode === user.referredBy);
        if (referrer) {
          const rewardAmount = rechargeAmount * 0.1;
          referrer.balance += rewardAmount;
          referrer.totalProfit += rewardAmount;

          const bonusTx: Transaction = {
            id: generateUUID(),
            type: 'bonus',
            desc: `Bónus de indicação (10%) — Depósito inicial de +258 ${user.phone}`,
            amount: rewardAmount,
            status: 'completed',
            date: new Date().toISOString(),
          };
          referrer.transactions.push(bonusTx);
          PersistenceManager.saveUser(referrer);

          PersistenceManager.writeAuditLog(currentAdmin.id, referrer.id, 'referral_bonus_applied', {
            rewardFromUser: user.id,
            rewardFromPhone: user.phone,
            bonus: rewardAmount,
          });

          // Mark active connection in user team profile
          const userMeta = referrer.team?.find((m) => m.phone === user.phone);
          if (userMeta) {
            userMeta.firstDepositAt = new Date().toISOString();
            PersistenceManager.saveUser(referrer);
          }
        }
      }
    }

    PersistenceManager.saveUser(user);
    toast(`Recarga de MZN ${fmt(rechargeAmount)} aprovada com sucesso!`, 'success');
    reloadData();
    onUpdatePlatform();
  };

  const handleRejectRecharge = (userPhone: string, txId: string) => {
    const user = PersistenceManager.getUserByPhone(userPhone);
    if (!user) return;

    const tx = user.transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    tx.status = 'rejected';
    PersistenceManager.saveUser(user);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'reject_recharge', { txId, userPhone });
    
    toast('Recarga recusada.', 'info');
    reloadData();
    onUpdatePlatform();
  };

  const handleApproveWithdrawal = (userPhone: string, txId: string) => {
    const user = PersistenceManager.getUserByPhone(userPhone);
    if (!user) return;

    const tx = user.transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    tx.status = 'completed';
    PersistenceManager.saveUser(user);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'approve_withdrawal', { txId, userPhone, netAmount: tx.amount });

    toast('Levantamento marcado como pago com sucesso!', 'success');
    reloadData();
    onUpdatePlatform();
  };

  const handleRejectWithdrawal = (userPhone: string, txId: string) => {
    const user = PersistenceManager.getUserByPhone(userPhone);
    if (!user) return;

    const tx = user.transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    // Refund money (withdrawal amount transaction was stored as negative!)
    const absRefund = Math.abs(tx.amount);
    user.balance += absRefund;
    tx.status = 'rejected';

    PersistenceManager.saveUser(user);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'reject_withdrawal', { txId, userPhone, refund: absRefund });

    toast('Levantamento rejeitado. Saldo devolvido ao utilizador.', 'info');
    reloadData();
    onUpdatePlatform();
  };

  const handleToggleBlock = (phone: string) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    if (user.isBlocked) {
      user.isBlocked = false;
      toast('A conta do utilizador foi reativada.', 'success');
      PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'user_unblock', { phone });
    } else {
      user.isBlocked = true;
      toast('A conta do utilizador foi suspensa comercialmente.', 'info');
      PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'user_block', { phone });
    }

    PersistenceManager.saveUser(user);
    reloadData();
    onUpdatePlatform();
  };

  const handleResetCollectCycle = (phone: string) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    user.lastCollectDate = null;
    if (user.vipActivatedAt) {
      user.vipActivatedAt = new Date().toISOString();
    }
    
    PersistenceManager.saveUser(user);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'user_cycle_reset', { phone });
    toast('Ciclo de 24h resetado com sucesso! O utilizador já pode realizar uma nova coleta.', 'success');
    reloadData();
    onUpdatePlatform();
  };

  const handleSaveUserVip = (phone: string, levelNum: number) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    const oldLevel = user.vipLevel;
    user.vipLevel = levelNum;

    if (levelNum > 0 && oldLevel === 0) {
      user.vipActivatedAt = new Date().toISOString();
      user.lastCollectDate = null;
    } else if (levelNum === 0) {
      user.vipActivatedAt = null;
      user.customDailyProfit = null;
    }

    PersistenceManager.saveUser(user);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'admin_update_user_vip', {
      oldLevel,
      newLevel: levelNum,
    });

    toast(`VIP do utilizador atualizado para nível ${levelNum}.`, 'success');
    reloadData();
    onUpdatePlatform();
  };

  const handleApplyCustomProfit = (phone: string) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    if (!customProfitInput.trim()) {
      user.customDailyProfit = null;
      toast('Rendimento diário redefinido para o padrão do VIP do utilizador.', 'info');
    } else {
      const num = parseFloat(customProfitInput);
      if (isNaN(num) || num < 0) {
        toast('Valor de rendimento inválido.', 'error');
        return;
      }
      user.customDailyProfit = num;
      toast(`Rendimento diário modificado para MZN ${fmt(num)}.`, 'success');
    }

    PersistenceManager.saveUser(user);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'admin_update_custom_profit', {
      customProfit: user.customDailyProfit,
    });
    setCustomProfitInput('');
    reloadData();
    onUpdatePlatform();
  };

  const handleAdjustBalance = (phone: string) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    const val = parseFloat(adjustBalanceInput);
    if (isNaN(val) || val <= 0) {
      toast('Insira um valor numérico válido.', 'error');
      return;
    }

    if (adjustBalanceType === 'add') {
      user.balance += val;
      // Also register an adjustment completed transaction
      const adjustTx: Transaction = {
        id: generateUUID(),
        type: 'adjust',
        desc: 'Crédito administrativo pelo suporte',
        amount: val,
        status: 'completed',
        date: new Date().toISOString(),
      };
      user.transactions.push(adjustTx);
      PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'admin_credit_balance', { amount: val });
      toast(`Adicionado MZN ${fmt(val)} com sucesso ao saldo!`, 'success');
    } else {
      if (user.balance < val) {
        toast('O saldo atual do utilizador é menor do que o solicitado para débito.', 'error');
        return;
      }
      user.balance -= val;
      const adjustTx: Transaction = {
        id: generateUUID(),
        type: 'adjust',
        desc: 'Débito administrativo pelo suporte',
        amount: -val,
        status: 'completed',
        date: new Date().toISOString(),
      };
      user.transactions.push(adjustTx);
      PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'admin_debit_balance', { amount: val });
      toast(`Debitado MZN ${fmt(val)} com sucesso do saldo!`, 'success');
    }

    PersistenceManager.saveUser(user);
    setAdjustBalanceInput('');
    reloadData();
    onUpdatePlatform();
  };

  const handleEditNamePass = async (phone: string) => {
    const user = PersistenceManager.getUserByPhone(phone);
    if (!user) return;

    if (editName.trim().length >= 2) {
      user.name = editName.trim();
    }
    if (editPass.trim().length >= 6) {
      user.passwordHash = await hashPassword(editPass);
    }

    PersistenceManager.saveUser(user);
    PersistenceManager.writeAuditLog(currentAdmin.id, user.id, 'admin_edit_profile', {
      nameChanged: !!editName,
      passwordChanged: !!editPass,
    });

    toast('Dados de perfil atualizados!', 'success');
    setEditName('');
    setEditPass('');
    reloadData();
    onUpdatePlatform();
  };

  const handleSaveConfigs = () => {
    if (cfgStartHour < 0 || cfgStartHour > 23 || cfgEndHour < 0 || cfgEndHour > 23) {
      toast('Hora de levantamento inválida (deve ser entre 0 e 23).', 'error');
      return;
    }
    if (cfgTax < 0 || cfgTax > 100) {
      toast('A taxa de comissão deve ser de 0% a 100%.', 'error');
      return;
    }
    if (!cfgEmolaNo || !cfgEmolaName) {
      toast('Deve preencher os dados de depósito para e-Mola.', 'error');
      return;
    }

    const updatedCfg: PlatformConfig = {
      withdrawHourStart: cfgStartHour,
      withdrawHourEnd: cfgEndHour,
      withdrawDiscountPct: cfgTax,
      emolaNumber: cfgEmolaNo.replace(/\D/g, ''),
      emolaName: cfgEmolaName,
      whatsappNumber: cfgWaNo.replace(/\D/g, ''),
      telegramLink: cfgTg,
    };

    PersistenceManager.saveConfig(updatedCfg);
    PersistenceManager.writeAuditLog(currentAdmin.id, null, 'save_platform_configs', updatedCfg);
    toast('Configurações gravadas com sucesso no sistema!', 'success');
    reloadData();
    onUpdatePlatform();
  };

  const handleSaveVIPSpecs = (level: number, c: number, p: number, d: number, e: string, img: string, name: string) => {
    const plans = PersistenceManager.getVIPPlans();
    const plan = plans.find((p) => p.level === level);
    if (!plan) return;

    plan.unlockCost = c;
    plan.dailyProfit = p;
    plan.days = d;
    plan.emoji = e;
    plan.image = img;
    plan.name = name;
    plan.rate = `${((p / c) * 100).toFixed(1)}%/dia`;

    PersistenceManager.saveVIPPlans(plans);
    PersistenceManager.writeAuditLog(currentAdmin.id, null, 'update_vip_plans_profile', { level, cost: c, profit: p });
    toast(`VIP nível ${level} atualizado com novas especificações!`, 'success');
    reloadData();
    onUpdatePlatform();
  };

  const handleCreateAdmin = async (e: FormEvent) => {
    e.preventDefault();
    const cleanPh = newAdminPhone.replace(/\D/g, '');
    
    if (newAdminName.trim().length < 2) {
      toast('Insira o nome do administrador.', 'error');
      return;
    }
    if (cleanPh.length < 9) {
      toast('Insira um telefone do novo administrador.', 'error');
      return;
    }
    if (newAdminPass.length < 8) {
      toast('Sugerimos uma senha forte com no mínimo 8 dígitos.', 'error');
      return;
    }

    const adminsList = PersistenceManager.getAdmins();
    if (adminsList.some((a) => a.phone === cleanPh)) {
      toast('Já existe um utilizador registado com perfil administrativo para esse número.', 'error');
      return;
    }

    const pwHash = await hashPassword(newAdminPass);
    const newAdminObj: Admin = {
      id: generateUUID(),
      name: newAdminName.trim(),
      phone: cleanPh,
      passwordHash: pwHash,
      role: 'admin',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    adminsList.push(newAdminObj);
    PersistenceManager.saveAdmins(adminsList);
    PersistenceManager.writeAuditLog(currentAdmin.id, null, 'create_new_sub_admin', { name: newAdminName, phone: cleanPh });

    toast('Novo administrador auxiliar registado com sucesso!', 'success');
    setNewAdminName('');
    setNewAdminPhone('');
    setNewAdminPass('');
    reloadData();
  };

  const handleRemoveAdmin = (adminId: string) => {
    let adminsList = PersistenceManager.getAdmins();
    const adminInst = adminsList.find((a) => a.id === adminId);
    if (!adminInst) return;

    if (adminInst.role === 'super') {
      toast('Não é possível apagar a conta do Super Administrador primário.', 'error');
      return;
    }

    adminsList = adminsList.filter((a) => a.id !== adminId);
    PersistenceManager.saveAdmins(adminsList);
    PersistenceManager.writeAuditLog(currentAdmin.id, null, 'delete_admin', { removedId: adminId });
    toast('Administrador removido com sucesso.', 'info');
    reloadData();
  };

  const handleSelfDestruct = () => {
    const code = prompt('Aviso Crítico: Isso irá deletar todas as transações, todas as recargas, depósitos e planos cadastrados!\nDigite "CONFIRMAR" para executar:');
    if (code !== 'CONFIRMAR') {
      toast('Operação cancelada.', 'info');
      return;
    }

    const pass = prompt('Por motivos de segurança, insira sua senha de Super Administrador:');
    if (!pass) return;

    hashPassword(pass).then((h) => {
      if (h !== currentAdmin.passwordHash) {
        toast('Senha incorreta. Abortando operação.', 'error');
        return;
      }

      PersistenceManager.selfDestruct();
      toast('Destruição concluída! Redirecionando...', 'success');
      setTimeout(() => {
        location.reload();
      }, 1500);
    });
  };

  // Compile calculations
  const totalBalance = users.reduce((acc, u) => acc + u.balance, 0);
  const totalRechargePaid = users.reduce((acc, u) => acc + (u.rechargeTotal || 0), 0);
  const totalCommissionPaid = users.reduce((acc, u) => acc + u.totalProfit, 0);

  // Extract recharges / withdrawal requests across all user transaction logs
  const allRechargeTxs: { userPhone: string; userName: string; tx: Transaction }[] = [];
  const allWithdrawalTxs: { userPhone: string; userName: string; tx: Transaction }[] = [];

  users.forEach((u) => {
    u.transactions?.forEach((t) => {
      if (t.type === 'recharge' || t.desc.toLowerCase().includes('recarga')) {
        allRechargeTxs.push({ userPhone: u.phone, userName: u.name, tx: t });
      }
      if (t.type === 'withdraw' || t.desc.toLowerCase().includes('levantamento')) {
        allWithdrawalTxs.push({ userPhone: u.phone, userName: u.name, tx: t });
      }
    });
  });

  // Sort by date newest first
  allRechargeTxs.sort((a, b) => new Date(b.tx.date).getTime() - new Date(a.tx.date).getTime());
  allWithdrawalTxs.sort((a, b) => new Date(b.tx.date).getTime() - new Date(a.tx.date).getTime());

  const pendingRecharges = allRechargeTxs.filter((r) => r.tx.status === 'pending');
  const pendingWithdrawals = allWithdrawalTxs.filter((w) => w.tx.status === 'pending');

  const filteredUsersList = users.filter((u) => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.phone.includes(userSearchQuery));

  const showSelectedUserDetail = selectedUserPhone ? PersistenceManager.getUserByPhone(selectedUserPhone) : null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[900] overflow-y-auto p-4 flex justify-center">
      <motion.div 
        initial={{ scale: 0.96, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-[#0d0d0d] border border-white/10 w-full max-w-4xl rounded-sm overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[85vh] my-4 text-white"
      >
        {/* Admin drawer nav */}
        <div className="bg-[#050505] p-5 md:w-64 flex flex-col border-r border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-serif italic text-lg tracking-widest text-[#e2cca8]">HTX Private</h2>
              <p className="text-[9px] text-white/40 font-mono uppercase tracking-[0.2em] mt-1">{currentAdmin.role === 'super' ? 'Acesso Total - Super' : 'Administrador Auxiliar'}</p>
            </div>
            <button type="button" onClick={onClose} className="md:hidden bg-white/5 p-1.5 rounded-sm text-white/40 hover:text-white border border-white/10 cursor-pointer">
              <X size={15} />
            </button>
          </div>

          <div className="space-y-1.5 flex-1">
            <button 
              type="button" 
              onClick={() => setActiveTab('dashboard')} 
              className={`w-full py-2.5 px-4 text-left text-[10px] tracking-widest uppercase rounded-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${activeTab === 'dashboard' ? 'bg-[#c5a880] text-black' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <BarChart2 size={14} /> Estatísticas
            </button>

            <button 
              type="button" 
              onClick={() => { setActiveTab('recharges'); reloadData(); }} 
              className={`w-full py-2.5 px-4 text-left text-[10px] tracking-widest uppercase rounded-sm font-bold flex items-center justify-between transition-colors cursor-pointer ${activeTab === 'recharges' ? 'bg-[#c5a880] text-black' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <span className="flex items-center gap-3"><CreditCard size={14} /> Recargas</span>
              {pendingRecharges.length > 0 && <span className="bg-red-500 text-white text-[9px] font-mono px-2 py-0.5 rounded-sm">{pendingRecharges.length}</span>}
            </button>

            <button 
              type="button" 
              onClick={() => { setActiveTab('withdrawals'); reloadData(); }} 
              className={`w-full py-2.5 px-4 text-left text-[10px] tracking-widest uppercase rounded-sm font-bold flex items-center justify-between transition-colors cursor-pointer ${activeTab === 'withdrawals' ? 'bg-[#c5a880] text-black' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <span className="flex items-center gap-3"><Download size={14} /> Levantamentos</span>
              {pendingWithdrawals.length > 0 && <span className="bg-[#e2cca8] text-black text-[9px] font-mono px-2 py-0.5 rounded-sm font-black">{pendingWithdrawals.length}</span>}
            </button>

            <button 
              type="button" 
              onClick={() => { setActiveTab('users'); reloadData(); }} 
              className={`w-full py-2.5 px-4 text-left text-[10px] tracking-widest uppercase rounded-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${activeTab === 'users' ? 'bg-[#c5a880] text-black' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <Users size={14} /> Utilizadores
            </button>

            {selectedUserPhone && (
              <button 
                type="button" 
                onClick={() => setActiveTab('userDetail')} 
                className={`w-full py-2.5 px-4 text-left text-[10px] tracking-widest uppercase rounded-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${activeTab === 'userDetail' ? 'bg-[#c5a880] text-black' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
              >
                <UserIcon size={14} /> Detalhe: {selectedUserPhone}
              </button>
            )}

            <button 
              type="button" 
              onClick={() => { setActiveTab('config'); reloadData(); }} 
              className={`w-full py-2.5 px-4 text-left text-[10px] tracking-widest uppercase rounded-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${activeTab === 'config' ? 'bg-[#c5a880] text-black' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <Settings size={14} /> Configurações
            </button>

            <button 
              type="button" 
              onClick={() => { setActiveTab('audit'); reloadData(); }} 
              className={`w-full py-2.5 px-4 text-left text-[10px] tracking-widest uppercase rounded-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${activeTab === 'audit' ? 'bg-[#c5a880] text-black' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <Sliders size={14} /> Logs Auditoria
            </button>

            {currentAdmin.role === 'super' && (
              <button 
                type="button" 
                onClick={() => { setActiveTab('admins'); reloadData(); }} 
                className={`w-full py-2.5 px-4 text-left text-[10px] tracking-widest uppercase rounded-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${activeTab === 'admins' ? 'bg-[#c5a880] text-black' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
              >
                <Lock size={14} /> Gestão Admins
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 text-center">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-3 text-[10px] tracking-widest uppercase font-bold rounded-sm border border-white/10 text-white/50 hover:text-white hover:bg-white/5 w-full cursor-pointer transition-colors"
            >
              Fechar Painel Admin
            </button>
          </div>
        </div>

        {/* Content detail area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[85vh]">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="font-serif italic text-lg text-[#e2cca8] tracking-widest">Painel Estatístico Global</h3>
                <button type="button" onClick={reloadData} className="p-2 text-white/40 hover:text-[#e2cca8] rounded-sm border border-white/5 hover:border-white/15 bg-white/[0.01] transition-all cursor-pointer">
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Grid 1 */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-[#050505] rounded-sm p-5 border border-white/10">
                  <span className="text-[9px] text-white/45 font-bold uppercase tracking-widest block mb-1">Total Utilizadores</span>
                  <span className="text-2xl font-serif italic block text-[#e2cca8] font-mono">{users.length}</span>
                </div>
                <div className="bg-[#050505] rounded-sm p-5 border border-white/10">
                  <span className="text-[9px] text-white/45 font-bold uppercase tracking-widest block mb-1">Ativos em Tiers VIP</span>
                  <span className="text-2xl font-serif italic block text-emerald-400 font-mono">{users.filter((u) => u.vipLevel > 0).length}</span>
                </div>
                <div className="bg-[#050505] rounded-sm p-5 border border-white/10">
                  <span className="text-[9px] text-white/45 font-bold uppercase tracking-widest block mb-1">Contas Suspensas</span>
                  <span className="text-2xl font-serif italic block text-rose-500 font-mono">{users.filter((u) => u.isBlocked).length}</span>
                </div>
                <div className="bg-[#050505] rounded-sm p-5 border border-white/10 col-span-2 lg:col-span-1">
                  <span className="text-[9px] text-white/45 font-bold uppercase tracking-widest block mb-1">Saldo Custodiado</span>
                  <span className="text-sm font-semibold block text-emerald-400 font-mono">MZN {fmt(totalBalance)}</span>
                </div>
                <div className="bg-[#050505] rounded-sm p-5 border border-white/10">
                  <span className="text-[9px] text-white/45 font-bold uppercase tracking-widest block mb-1">Lifetime Aprovado</span>
                  <span className="text-sm font-semibold block text-[#e2cca8] font-mono">MZN {fmt(totalRechargePaid)}</span>
                </div>
                <div className="bg-[#050505] rounded-sm p-5 border border-white/10">
                  <span className="text-[9px] text-white/45 font-bold uppercase tracking-widest block mb-1">Lucros Distribuidos</span>
                  <span className="text-sm font-semibold block text-[#e2cca8] font-mono">MZN {fmt(totalCommissionPaid)}</span>
                </div>
              </div>

              {/* Live pending alerts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#050505] rounded-sm p-5 border border-white/10 flex items-center justify-between shadow-lg">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-white/80 mb-1">Recargas Pendentes</h4>
                    <span className="text-white/40 text-[10px] block font-mono">{pendingRecharges.length} pedidos no total</span>
                  </div>
                  <button type="button" onClick={() => setActiveTab('recharges')} className="bg-[#c5a880]/10 hover:bg-[#c5a880]/20 border border-[#c5a880]/30 text-[#e2cca8] rounded-sm px-4 py-2.5 text-[10px] tracking-widest uppercase font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                    Analisar <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="bg-[#050505] rounded-sm p-5 border border-white/10 flex items-center justify-between shadow-lg">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-white/80 mb-1">Levantamentos Pendentes</h4>
                    <span className="text-white/40 text-[10px] block font-mono">{pendingWithdrawals.length} solicitações no total</span>
                  </div>
                  <button type="button" onClick={() => setActiveTab('withdrawals')} className="bg-[#c5a880]/10 hover:bg-[#c5a880]/20 border border-[#c5a880]/30 text-[#e2cca8] rounded-sm px-4 py-2.5 text-[10px] tracking-widest uppercase font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                    Analisar <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recharges' && (
            <div className="space-y-5">
              <h3 className="font-serif italic text-lg text-[#e2cca8] tracking-widest mb-4">Processamento de Recargas e-Mola</h3>
              
              {allRechargeTxs.length === 0 ? (
                <div className="text-center py-12 bg-[#050505] rounded-sm border border-white/5 text-white/40 text-[11px] tracking-wide">
                  Nenhum histórico ou pedido de recarga encontrado no sistema.
                </div>
              ) : (
                <div className="space-y-4">
                  {allRechargeTxs.map(({ userPhone, userName, tx }) => {
                    const isImg = tx.proofUrl && /\.(jpe?g|png|gif|webp)/i.test(tx.proofUrl);
                    return (
                      <div key={tx.id} className="bg-[#050505] p-5 rounded-sm border border-white/10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div>
                            <span className="font-bold block text-xs uppercase tracking-wider text-white">{userName}</span>
                            <span className="text-[10px] text-white/40 block font-mono">+258 {userPhone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-white/40 font-mono block">{new Date(tx.date).toLocaleDateString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className={`text-[9px] font-mono uppercase tracking-widest font-bold py-1 px-3 rounded-sm border ${
                              tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              tx.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {tx.status === 'completed' ? 'Aprovado' : tx.status === 'rejected' ? 'Recusado' : 'Pendente'}
                            </span>
                          </div>
                        </div>

                        <div className="bg-black border border-white/5 rounded-sm p-4 mb-3 text-xs text-white/70 font-mono">
                          Transferência requerida de: <strong className="text-white">MZN {fmt(tx.amount)}</strong>
                        </div>

                        {tx.proofUrl && (
                          <div className="mb-4">
                            <span className="block text-[9px] uppercase font-bold text-white/40 mb-1.5 leading-none tracking-wider">Comprovativo Carregado:</span>
                            {isImg ? (
                              <img 
                                src={tx.proofUrl} 
                                alt="Comprovativo" 
                                className="max-h-40 rounded-sm max-w-full object-contain cursor-zoom-in hover:opacity-95 inline-block border border-white/10"
                                onClick={() => {
                                  const win = window.open();
                                  if (win && tx.proofUrl) win.document.write(`<img src="${tx.proofUrl}" style="max-width:100%;" />`);
                                }} 
                              />
                            ) : (
                              <a href={tx.proofUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[#e2cca8] underline hover:text-[#c5a880] block font-mono">
                                Abrir Documento de Depósito (PDF/Anexo)
                              </a>
                            )}
                          </div>
                        )}

                        {tx.status === 'pending' && (
                          <div className="flex items-center gap-3">
                            <button 
                              type="button" 
                              onClick={() => handleApproveRecharge(userPhone, tx.id)}
                              className="px-4 py-2.5 bg-[#c5a880] hover:bg-[#a18863] text-black font-bold rounded-sm text-[10px] tracking-widest uppercase flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Check size={13} /> Aprovar Depósito
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleRejectRecharge(userPhone, tx.id)}
                              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded-sm text-[10px] tracking-widest uppercase font-bold cursor-pointer transition-colors"
                            >
                              Recusar Pedido
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'withdrawals' && (
            <div className="space-y-5">
              <h3 className="font-serif italic text-lg text-[#e2cca8] tracking-widest mb-4">Solicitações de Levantamento no M-Pesa</h3>

              {allWithdrawalTxs.length === 0 ? (
                <div className="text-center py-12 bg-[#050505] rounded-sm border border-white/5 text-white/40 text-[11px] tracking-wide">
                  Nenhuma ordem de saque no histórico geral.
                </div>
              ) : (
                <div className="space-y-4">
                  {allWithdrawalTxs.map(({ userPhone, userName, tx }) => {
                    const gross = Math.abs(tx.amount);
                    const defaultTaxVal = platformConfig.withdrawDiscountPct;
                    // In-app transactions stored net or gross depending on how was designed. Let's calculate based on platforms tax rate setup.
                    const chargeTaxFee = gross * (defaultTaxVal / 100);
                    const netPayout = gross - chargeTaxFee;

                    return (
                      <div key={tx.id} className="bg-[#050505] p-5 rounded-sm border border-white/10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div>
                            <span className="font-bold block text-xs uppercase tracking-wider text-white">{userName}</span>
                            <span className="text-[10px] text-white/40 block font-mono">Número do utilizador: +258 {userPhone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-white/40 font-mono block">{new Date(tx.date).toLocaleDateString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className={`text-[9px] font-mono uppercase tracking-widest font-bold py-1 px-3 rounded-sm border ${
                              tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              tx.status === 'rejected' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {tx.status === 'completed' ? 'Pago' : tx.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                            </span>
                          </div>
                        </div>

                        <div className="bg-black border border-white/5 rounded-sm p-4 mb-3 space-y-1.5 text-xs text-white/50 font-mono">
                          <div className="flex justify-between"><span>Valor solicitado bruto:</span><span className="text-white font-bold">MZN {fmt(gross)}</span></div>
                          <div className="flex justify-between"><span>Taxa de Saque administrativa ({defaultTaxVal}%):</span><span className="text-rose-400 font-semibold">- MZN {fmt(chargeTaxFee)}</span></div>
                          <div className="flex justify-between border-t border-white/10 pt-1.5 text-xs">
                            <span className="font-bold text-white/70">Líquido a ser pago M-Pesa:</span>
                            <span className="text-emerald-400 font-bold font-mono">MZN {fmt(netPayout)}</span>
                          </div>
                          <div className="flex justify-between border-t border-white/10 pt-1.5 text-xs">
                            <span className="font-bold text-white/70">Número de Pagamento M-Pesa:</span>
                            <span className="text-[#e2cca8] font-bold font-mono tracking-wider">{tx.payoutPhone ? `+258 ${tx.payoutPhone}` : `+258 ${userPhone}`}</span>
                          </div>
                        </div>

                        {tx.status === 'pending' && (
                          <div className="flex items-center gap-3">
                            <button 
                              type="button" 
                              onClick={() => handleApproveWithdrawal(userPhone, tx.id)}
                              className="px-4 py-2.5 bg-[#c5a880] hover:bg-[#a18863] text-black font-bold rounded-sm text-[10px] tracking-widest uppercase flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Check size={13} /> Marcar como Pago via M-Pesa
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleRejectWithdrawal(userPhone, tx.id)}
                              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded-sm text-[10px] tracking-widest uppercase font-bold cursor-pointer transition-colors"
                            >
                              Rejeitar e Estornar Saldo
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-3 gap-3 flex-wrap">
                <h3 className="font-serif italic text-lg text-[#e2cca8] tracking-widest">Controle de Utilizadores</h3>
                {currentAdmin.role === 'super' && (
                  <button
                    type="button"
                    onClick={() => setShowCreateUserModal(!showCreateUserModal)}
                    className="bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] uppercase font-bold tracking-widest px-4 py-2.5 rounded-sm cursor-pointer transition-colors flex items-center gap-1.5 shadow-md"
                  >
                    <Plus size={13} /> Novo Utilizador Manual
                  </button>
                )}
              </div>

              {/* Create User Manual Formulary */}
              {currentAdmin.role === 'super' && showCreateUserModal && (
                <motion.form 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleCreateUserManual}
                  className="bg-[#050505] p-5 rounded-sm border border-[#c5a880]/30 space-y-4 shadow-xl text-[#E5E5E5]"
                >
                  <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
                    <h4 className="font-serif italic text-sm text-[#e2cca8] tracking-wider">Criar Novo Utilizador (Acesso Total)</h4>
                    <button 
                      type="button" 
                      onClick={() => setShowCreateUserModal(false)}
                      className="text-white/40 hover:text-white p-1 hover:bg-white/5 rounded-sm cursor-pointer transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 mb-1">Nome Completo</label>
                      <input 
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Nome fictício ou real"
                        required
                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#c5a880] text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 mb-1">Celular (9 dígitos)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-mono border-r pr-2 leading-none border-white/10">+258</span>
                        <input 
                          type="tel"
                          value={newUserPhone}
                          onChange={(e) => setNewUserPhone(e.target.value)}
                          placeholder="84XXXXXXX"
                          maxLength={12}
                          required
                          className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm pl-16 pr-3 py-2.5 text-xs focus:outline-none focus:border-[#c5a880] text-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 mb-1">Senha Secreta</label>
                      <input 
                        type="password"
                        value={newUserPass}
                        onChange={(e) => setNewUserPass(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#c5a880] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 mb-1">Saldo Inicial (MZN)</label>
                      <input 
                        type="number"
                        value={newUserBalance}
                        onChange={(e) => setNewUserBalance(e.target.value)}
                        placeholder="Ex: 500"
                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#c5a880] text-emerald-400 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 mb-1">Nível VIP Inicial</label>
                      <select 
                        value={newUserVip}
                        onChange={(e) => setNewUserVip(parseInt(e.target.value) || 0)}
                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#c5a880] text-white font-mono cursor-pointer"
                      >
                        {vipPlans.map((v) => (
                          <option key={v.level} value={v.level}>VIP {v.level} - {v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button 
                        type="submit"
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-bold tracking-widest uppercase py-3 rounded-sm transition-colors cursor-pointer"
                      >
                        ✔ Salvar e Registrar Utilizador
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}

              <div className="relative">
                <input 
                  type="text" 
                  value={userSearchQuery}
                  onChange={(e) => { setUserSearchQuery(e.target.value); }}
                  placeholder="Filtrar por nome ou número +258..."
                  className="w-full bg-black border border-white/10 rounded-sm px-10 py-3.5 text-xs focus:outline-none focus:border-[#c5a880] text-white font-mono placeholder:text-white/20 placeholder:font-sans"
                />
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              </div>

              {filteredUsersList.length === 0 ? (
                <div className="text-center py-12 text-white/40 bg-[#050505] border border-white/5 rounded-sm text-xs font-mono">
                  Nenhum utilizador corresponde à sua pesquisa.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredUsersList.map((u) => (
                    <div 
                      key={u.id} 
                      onClick={() => { setSelectedUserPhone(u.phone); setActiveTab('userDetail'); }}
                      className="bg-[#050505] p-4 rounded-sm border border-white/10 cursor-pointer hover:border-[#c5a880]/50 transition-colors flex items-center justify-between shadow-md"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase tracking-wider text-white max-w-[150px] truncate">{u.name}</span>
                          {u.isBlocked && <span className="bg-rose-500 text-white text-[8px] font-mono font-black px-1.5 py-0.2 rounded-sm leading-none">SUSPENSO</span>}
                        </div>
                        <span className="text-[10px] text-white/40 font-mono block mt-0.5">+258 {u.phone}</span>
                        <span className="text-[10px] text-[#e2cca8] font-light block mt-1">Membro VIP {u.vipLevel}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-0.5 font-mono">Saldo Disponível</span>
                        <span className="text-xs font-mono font-bold text-emerald-400 block">MZN {fmt(u.balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'userDetail' && showSelectedUserDetail && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="font-serif italic text-lg text-[#e2cca8] tracking-widest">{showSelectedUserDetail.name}</h3>
                  <p className="text-[10px] font-mono text-white/40 mt-1">+258 {showSelectedUserDetail.phone}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button 
                    type="button" 
                    onClick={() => handleToggleBlock(showSelectedUserDetail.phone)}
                    className={`px-4 py-2 rounded-sm text-[10px] tracking-widest uppercase font-bold border transition-colors cursor-pointer ${showSelectedUserDetail.isBlocked ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-red-500/10 text-rose-500 border-red-500/20 hover:bg-red-500/20'}`}
                  >
                    {showSelectedUserDetail.isBlocked ? 'Desbloquear Acesso' : 'Bloquear Utilizador'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleResetCollectCycle(showSelectedUserDetail.phone)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded-sm text-[10px] tracking-widest uppercase font-bold cursor-pointer transition-colors"
                  >
                    Resetar Ciclo 24h
                  </button>
                  {currentAdmin.role === 'super' && (
                    <button 
                      type="button"
                      onClick={() => handleDeleteUserManual(showSelectedUserDetail.phone)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-sm text-[10px] tracking-widest uppercase font-black cursor-pointer transition-colors shadow-lg"
                    >
                      Excluir Conta Permanentemente
                    </button>
                  )}
                </div>
              </div>

              {/* Quick statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-black border border-white/10 p-4 rounded-sm text-center shadow-inner">
                  <span className="text-[9px] text-white/45 uppercase font-bold tracking-widest block mb-1">Saldo Atual</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">MZN {fmt(showSelectedUserDetail.balance)}</span>
                </div>
                <div className="bg-black border border-white/10 p-4 rounded-sm text-center shadow-inner">
                  <span className="text-[9px] text-white/45 uppercase font-bold tracking-widest block mb-1">Lifetime Recarregado</span>
                  <span className="text-sm font-bold font-mono text-[#e2cca8]">MZN {fmt(showSelectedUserDetail.rechargeTotal || 0)}</span>
                </div>
                <div className="bg-black border border-white/10 p-4 rounded-sm text-center shadow-inner">
                  <span className="text-[9px] text-white/45 uppercase font-bold tracking-widest block mb-1">Lucro Retirado</span>
                  <span className="text-sm font-bold font-mono text-[#e2cca8]">MZN {fmt(showSelectedUserDetail.totalProfit)}</span>
                </div>
                <div className="bg-black border border-white/10 p-4 rounded-sm text-center shadow-inner">
                  <span className="text-[9px] text-white/45 uppercase font-bold tracking-widest block mb-1">Nível de Investidor</span>
                  <span className="text-sm font-bold font-serif italic text-[#e2cca8] block">VIP {showSelectedUserDetail.vipLevel}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Section A: Balance adjuster and VIP level modifier */}
                <div className="space-y-4 bg-[#050505] p-5 rounded-sm border border-white/10">
                  <h4 className="font-serif italic text-[13px] text-[#e2cca8] tracking-wider mb-2 border-b border-white/5 pb-2">Modificadores Rápidos de Caixa</h4>
                  
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/55 mb-1.5">Ajustar Saldo Disponível</label>
                    <div className="flex gap-2">
                      <select 
                        value={adjustBalanceType}
                        onChange={(e: any) => setAdjustBalanceType(e.target.value)}
                        className="bg-black border border-white/10 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-[#c5a880] text-white cursor-pointer"
                      >
                        <option value="add">Adicionar</option>
                        <option value="remove">Debitar</option>
                      </select>
                      <input 
                        type="number" 
                        value={adjustBalanceInput}
                        onChange={(e) => setAdjustBalanceInput(e.target.value)}
                        placeholder="MZN Montante"
                        className="bg-black border border-white/10 rounded-sm px-4 py-2 text-xs focus:outline-none focus:border-[#c5a880] flex-1 text-white font-mono placeholder:text-white/20 placeholder:font-sans"
                      />
                      <button 
                        type="button" 
                        onClick={() => handleAdjustBalance(showSelectedUserDetail.phone)}
                        className="bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] font-bold tracking-widest uppercase px-4 py-2.5 rounded-sm transition-colors cursor-pointer"
                      >
                        Executar
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/55 mb-1.5">Definir Nível de Plano VIP (Manual)</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {vipPlans.map((v) => (
                        <button 
                          key={v.level} 
                          type="button" 
                          onClick={() => handleSaveUserVip(showSelectedUserDetail.phone, v.level)}
                          className={`py-2 px-1 text-center font-mono text-[10px] font-bold rounded-sm border cursor-pointer transition-colors ${
                            showSelectedUserDetail.vipLevel === v.level ? 'bg-[#c5a880] border-[#c5a880] text-black' : 'bg-black text-white/50 border-white/10 hover:bg-white/5'
                          }`}
                        >
                          VIP {v.level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section B: Custom earnings override and security manager */}
                <div className="space-y-4 bg-[#050505] p-5 rounded-sm border border-white/10">
                  <h4 className="font-serif italic text-[13px] text-[#e2cca8] tracking-wider mb-2 border-b border-white/5 pb-2">Modificadores de Incentivo</h4>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/55 mb-1.5">Estipular Renda Diária Personalizada (MZN/dia)</label>
                    <div className="text-[10px] text-white/40 leading-tight mb-2 font-light">
                      Deixar em branco para usar o valor padrão ({vipPlans[showSelectedUserDetail.vipLevel]?.dailyProfit || 0} MT/dia).
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={customProfitInput}
                        onChange={(e) => setCustomProfitInput(e.target.value)}
                        placeholder={showSelectedUserDetail.customDailyProfit ? `Remover personalizada: MZN ${showSelectedUserDetail.customDailyProfit}` : 'Estipular montante diário customizado'}
                        className="bg-black border border-white/10 rounded-sm px-4 py-2 text-xs focus:outline-none focus:border-[#c5a880] flex-1 text-white font-mono placeholder:text-white/20 placeholder:font-sans"
                      />
                      <button 
                        type="button" 
                        onClick={() => handleApplyCustomProfit(showSelectedUserDetail.phone)}
                        className="bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] font-bold tracking-widest uppercase px-4 py-2.5 rounded-sm transition-colors cursor-pointer"
                      >
                        Estipular
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/55 mb-2">Editar Dados Cadastrais</label>
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Alterar nome completo oficial"
                        className="w-full bg-black border border-white/10 rounded-sm px-4 py-2.5 text-xs focus:outline-none focus:border-[#c5a880] text-white"
                      />
                      <input 
                        type="password" 
                        value={editPass}
                        onChange={(e) => setEditPass(e.target.value)}
                        placeholder="Alterar para nova senha secreta (min. 6 dígitos)"
                        className="w-full bg-black border border-white/10 rounded-sm px-4 py-2.5 text-xs focus:outline-none focus:border-[#c5a880] text-white"
                      />
                      <button 
                        type="button" 
                        onClick={() => handleEditNamePass(showSelectedUserDetail.phone)}
                        className="bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 w-full py-2.5 text-[10px] tracking-widest uppercase rounded-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Save size={13} /> Aplicar Alterações Cadastrais
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete layout transaction logs */}
              <div className="bg-[#050505] p-5 rounded-sm border border-white/10 mt-4 text-[#e5e5e5]">
                <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                  <h4 className="font-serif italic text-[13px] text-[#e2cca8] tracking-wider">Histórico de Transações do Utilizador</h4>
                  <span className="text-[10px] text-white/40 font-mono">Qtd: {showSelectedUserDetail.transactions?.length || 0}</span>
                </div>

                {/* Form to insert manual transaction - Super Admin exclusive */}
                {currentAdmin.role === 'super' && (
                  <div className="bg-black/40 border border-[#c5a880]/15 p-4 rounded-sm mb-4 space-y-3">
                    <h5 className="font-serif italic text-xs text-[#e2cca8] tracking-wide">Lançar Nova Transação Manual (Ajuste Direto)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div>
                        <label className="block text-[8px] uppercase tracking-widest text-[#e2cca8]/50 mb-1">Descrição do Lançamento</label>
                        <input 
                          type="text" 
                          value={newTxDesc}
                          onChange={(e) => setNewTxDesc(e.target.value)}
                          placeholder="Ex: Bônus de Evento de Depósito"
                          className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase tracking-widest text-[#e2cca8]/50 mb-1">Montante (MZN)</label>
                        <input 
                          type="number" 
                          value={newTxAmount}
                          onChange={(e) => setNewTxAmount(e.target.value)}
                          placeholder="Ex: 250 ou -100 (débito)"
                          className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm px-2.5 py-1.5 text-xs font-mono text-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase tracking-widest text-[#e2cca8]/50 mb-1">Tipo de Lançamento</label>
                        <select 
                          value={newTxType}
                          onChange={(e: any) => setNewTxType(e.target.value)}
                          className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm px-2 py-1.5 text-xs text-white cursor-pointer font-mono"
                        >
                          <option value="adjust">Ajuste Geral (adjust)</option>
                          <option value="bonus">Bónus Oficial (bonus)</option>
                          <option value="profit">Renda Diária (profit)</option>
                          <option value="recharge">Recarga Manual (recharge)</option>
                          <option value="withdraw">Levantamento (withdraw)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase tracking-widest text-[#e2cca8]/50 mb-1">Status da Transação</label>
                        <div className="flex gap-2">
                          <select 
                            value={newTxStatus}
                            onChange={(e: any) => setNewTxStatus(e.target.value)}
                            className="w-full bg-[#0d0d0d] border border-white/10 rounded-sm px-2 py-1.5 text-xs text-white cursor-pointer font-mono"
                          >
                            <option value="completed">Concluída (completed)</option>
                            <option value="pending">Pendente (pending)</option>
                            <option value="rejected">Rejeitada (rejected)</option>
                          </select>
                          <button 
                            type="button" 
                            onClick={() => handleAddTransactionManual(showSelectedUserDetail.phone)}
                            className="bg-[#c5a880] hover:bg-[#a18863] text-black font-black text-[9px] uppercase px-3 py-1.5 rounded-sm cursor-pointer transition-colors"
                          >
                            Lançar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showSelectedUserDetail.transactions?.length === 0 ? (
                  <div className="text-center py-6 text-white/30 text-xs font-mono">Utilizador sem transações registradas.</div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 no-scrollbar text-xs">
                    {showSelectedUserDetail.transactions.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-3 rounded-sm bg-black border border-white/5 gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-white/85 font-mono text-xs">{t.desc}</strong>
                            <span className="text-[8px] font-mono tracking-widest font-bold uppercase border border-white/10 px-1 py-0.1 bg-white/5 rounded-sm">{t.type}</span>
                            <span className={`text-[8px] font-mono tracking-widest font-bold uppercase rounded-sm px-1 ${
                              t.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/10' :
                              t.status === 'pending' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/10' :
                              'text-rose-400 bg-rose-500/10 border border-rose-500/10'
                            }`}>{t.status}</span>
                          </div>
                          <span className="text-[10px] text-white/40 font-mono block mt-1">{new Date(t.date).toLocaleString('pt-MZ')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono font-bold text-xs tracking-wide ${t.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.amount >= 0 ? '+' : ''}MZN {fmt(Math.abs(t.amount))}
                          </span>
                          {currentAdmin.role === 'super' && (
                            <button 
                              type="button" 
                              onClick={() => handleDeleteTransaction(showSelectedUserDetail.phone, t.id)}
                              className="text-rose-400 hover:text-rose-600 p-1.5 hover:bg-rose-500/10 rounded-sm cursor-pointer transition-colors"
                              title="Remover Registro de Transação"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <h3 className="font-serif italic text-lg text-[#e2cca8] tracking-widest mb-4"><Sliders size={15} className="inline mr-2 text-[#e2cca8]" /> Configurações de Operação</h3>

              <div className="bg-[#050505] p-5 rounded-sm border border-white/10 space-y-4">
                <h4 className="font-serif italic text-xs text-[#e2cca8] tracking-widest border-b border-white/5 pb-2">🕛 Parâmetros Operacionais Gerais</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Saque Livre - Hora de Início (0-23)</label>
                    <input 
                      type="number" 
                      value={cfgStartHour}
                      onChange={(e) => setCfgStartHour(parseInt(e.target.value) || 0)}
                      min={0}
                      max={23}
                      className="w-full bg-black border border-white/10 rounded-sm px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Saque Livre - Hora Limite (0-23)</label>
                    <input 
                      type="number" 
                      value={cfgEndHour}
                      onChange={(e) => setCfgEndHour(parseInt(e.target.value) || 0)}
                      min={0}
                      max={23}
                      className="w-full bg-black border border-white/10 rounded-sm px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Taxa de Saque (%)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={cfgTax}
                        onChange={(e) => setCfgTax(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={100}
                        className="w-full bg-black border border-white/10 rounded-sm pl-4 pr-8 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-[#c5a880]"
                      />
                      <Percent size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Número Carteira de Recebimento e-Mola</label>
                    <input 
                      type="text" 
                      value={cfgEmolaNo}
                      onChange={(e) => setCfgEmolaNo(e.target.value)}
                      placeholder="Ex: 867090687"
                      className="w-full bg-black border border-white/10 rounded-sm px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Nome do Titular e-Mola cadastrado</label>
                    <input 
                      type="text" 
                      value={cfgEmolaName}
                      onChange={(e) => setCfgEmolaName(e.target.value)}
                      placeholder="Ex: Aninha Basto"
                      className="w-full bg-black border border-white/10 rounded-sm px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Ligação WhatsApp Suporte (sem +)</label>
                    <input 
                      type="text" 
                      value={cfgWaNo}
                      onChange={(e) => setCfgWaNo(e.target.value)}
                      placeholder="Ex: 258840000000"
                      className="w-full bg-black border border-white/10 rounded-sm px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Ligação Canal Telegram</label>
                    <input 
                      type="text" 
                      value={cfgTg}
                      onChange={(e) => setCfgTg(e.target.value)}
                      placeholder="Ex: https://t.me/HTXInvestMZ"
                      className="w-full bg-black border border-white/10 rounded-sm px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={handleSaveConfigs}
                  className="bg-[#c5a880] hover:bg-[#a18863] text-black px-[#c5a880] py-3 rounded-sm font-bold text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer w-full transition-colors mt-2"
                >
                  <Save size={14} /> Gravar Parâmetros no Sistema
                </button>
              </div>

              {/* VIP Levels parameters updates */}
              <div className="bg-[#050505] p-5 rounded-sm border border-white/10 space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2 flex-wrap gap-2">
                  <h4 className="font-serif italic text-xs text-[#e2cca8] tracking-widest flex items-center gap-1.5">
                    <Check size={14} className="text-[#e2cca8]" /> Tabela de Rendimento dos Planos VIP
                  </h4>
                  {currentAdmin.role === 'super' && (
                    <button
                      type="button"
                      onClick={() => setShowCreateVipForm(!showCreateVipForm)}
                      className="bg-[#c5a880] hover:bg-[#a18863] text-black text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Plus size={11} /> Novo Plano VIP
                    </button>
                  )}
                </div>

                {currentAdmin.role === 'super' && showCreateVipForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    onSubmit={handleAddNewVipPlan}
                    className="bg-black/50 border border-[#c5a880]/35 p-4 rounded-sm space-y-3 shadow-xl text-[#e5e5e5]"
                  >
                    <h5 className="font-serif italic text-xs text-[#e2cca8] tracking-wider">Criar Novo Nível VIP Personalizado</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[8px] uppercase font-bold tracking-widest text-white/40 mb-1">Nível VIP (Numérico)</label>
                        <input
                          type="number"
                          value={newVipLevel || ''}
                          onChange={(e) => setNewVipLevel(parseInt(e.target.value) || 0)}
                          placeholder="Ex: 9"
                          required
                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-[#c5a880]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase font-bold tracking-widest text-white/40 mb-1">Nome Editorial VIP</label>
                        <input
                          type="text"
                          value={newVipName}
                          onChange={(e) => setNewVipName(e.target.value)}
                          placeholder="Ex: Titânio Imperial"
                          required
                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-[#c5a880]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase font-bold tracking-widest text-white/40 mb-1">Custo de Desbloqueio</label>
                        <input
                          type="number"
                          value={newVipCost || ''}
                          onChange={(e) => setNewVipCost(parseFloat(e.target.value) || 0)}
                          placeholder="Ex: 25000"
                          required
                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-emerald-400 font-mono w-full focus:outline-none focus:border-[#c5a880]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase font-bold tracking-widest text-white/40 mb-1">Renda Diária (MZN)</label>
                        <input
                          type="number"
                          value={newVipProfit || ''}
                          onChange={(e) => setNewVipProfit(parseFloat(e.target.value) || 0)}
                          placeholder="Ex: 1200"
                          required
                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-[#c5a880] font-mono w-full focus:outline-none focus:border-[#c5a880]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[8px] uppercase font-bold tracking-widest text-white/40 mb-1">Dias de Duração</label>
                        <input
                          type="number"
                          value={newVipDays}
                          onChange={(e) => setNewVipDays(parseInt(e.target.value) || 30)}
                          placeholder="Ex: 30"
                          required
                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-[#c5a880]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase font-bold tracking-widest text-white/40 mb-1">Ícone Emoji</label>
                        <input
                          type="text"
                          value={newVipEmoji}
                          onChange={(e) => setNewVipEmoji(e.target.value)}
                          placeholder="👑"
                          className="bg-black border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-center font-mono w-full focus:outline-none focus:border-[#c5a880]"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-black text-[9px] uppercase font-bold tracking-widest py-2.5 rounded-sm cursor-pointer transition-all"
                        >
                          ✔ Inaugurar VIP
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}

                <div className="text-[10px] text-white/40 leading-tight font-light">
                  Aviso: As alterações inseridas e gravadas abaixo entrarão em vigor imediatamente na vitrine de Planos para compra.
                </div>

                <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-1">
                  {vipPlans.filter((p) => p.level > 0).map((v) => (
                    <div key={v.level} className="bg-black p-4 rounded-sm border border-white/5 space-y-3">
                      <div className="text-[10px] font-mono tracking-widest uppercase font-black text-[#e2cca8] block pb-1 border-b border-white/5">
                        Nível VIP {v.level} specs:
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Nome Editorial</label>
                          <input 
                            type="text" 
                            id={`vipex-name-${v.level}`}
                            defaultValue={v.name}
                            className="bg-black border border-white/10 rounded-sm px-2 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-[#c5a880]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Custo (MZN)</label>
                          <input 
                            type="number" 
                            id={`vipex-cost-${v.level}`}
                            defaultValue={v.unlockCost}
                            className="bg-black border border-white/10 rounded-sm px-2 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-[#c5a880]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Renda Diária (MZN)</label>
                          <input 
                            type="number" 
                            id={`vipex-profit-${v.level}`}
                            defaultValue={v.dailyProfit}
                            className="bg-black border border-white/10 rounded-sm px-2 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-[#c5a880]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Duração (Dias)</label>
                          <input 
                            type="number" 
                            id={`vipex-days-${v.level}`}
                            defaultValue={v.days}
                            className="bg-black border border-white/10 rounded-sm px-2 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-[#c5a880]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Ícone Emoji</label>
                          <input 
                            type="text" 
                            id={`vipex-emoji-${v.level}`}
                            defaultValue={v.emoji}
                            className="bg-black border border-white/10 rounded-sm px-2 py-1.5 text-xs text-white font-mono w-full text-center focus:outline-none focus:border-[#c5a880]"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Imagem URL (Mockup)</label>
                          <input 
                            type="text" 
                            id={`vipex-img-${v.level}`}
                            defaultValue={v.image}
                            className="bg-black border border-white/10 rounded-sm px-2 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-[#c5a880]"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2.5">
                        {currentAdmin.role === 'super' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteVipPlan(v.level)}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/20 font-bold px-3 py-2 rounded-sm text-[10px] tracking-widest uppercase cursor-pointer transition-colors"
                          >
                            Excluir VIP {v.level}
                          </button>
                        )}
                        <button 
                          type="button" 
                          onClick={() => {
                            const name = (document.getElementById(`vipex-name-${v.level}`) as HTMLInputElement)?.value;
                            const cost = parseFloat((document.getElementById(`vipex-cost-${v.level}`) as HTMLInputElement)?.value) || 0;
                            const profit = parseFloat((document.getElementById(`vipex-profit-${v.level}`) as HTMLInputElement)?.value) || 0;
                            const days = parseInt((document.getElementById(`vipex-days-${v.level}`) as HTMLInputElement)?.value) || 30;
                            const emoji = (document.getElementById(`vipex-emoji-${v.level}`) as HTMLInputElement)?.value;
                            const img = (document.getElementById(`vipex-img-${v.level}`) as HTMLInputElement)?.value;
                            handleSaveVIPSpecs(v.level, cost, profit, days, emoji, img, name);
                          }}
                          className="bg-[#c5a880] hover:bg-[#a18863] text-black font-bold px-3 py-2 rounded-sm text-[10px] tracking-widest uppercase cursor-pointer transition-colors"
                        >
                          Mais Atualização VIP {v.level}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              <h3 className="font-serif italic text-lg text-[#e2cca8] tracking-widest mb-1">📋 Histórico de Auditoria Geral</h3>
              <p className="text-[10px] text-white/40 font-light mt-1">Registos imutáveis gerados a cada alteração ou acção de funcionários administratvos.</p>

              {auditLogs.length === 0 ? (
                <div className="text-center py-12 text-white/40 bg-[#050505] border border-white/5 rounded-sm text-xs font-mono">
                  Nenhum registo de log encontrado nas tabelas locais.
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 no-scrollbar text-xs">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="bg-[#050505] p-3 rounded-sm border border-white/10 space-y-1.5 shadow-sm">
                      <div className="flex justify-between items-center text-white/70">
                        <strong className="text-[#e2cca8] font-mono tracking-wide block uppercase text-[9px] font-black">{log.action}</strong>
                        <span className="text-[9px] text-white/45 font-mono">{new Date(log.createdAt).toLocaleString('pt-MZ')}</span>
                      </div>
                      <div className="text-[10px] text-white/50 leading-tight">
                        {log.adminId && <span className="block font-mono text-white/30">ID Admin Executor: {log.adminId}</span>}
                        {log.userId && <span className="block font-mono text-white/30">ID Utilizador Alvo: {log.userId}</span>}
                        {log.details && (
                          <pre className="mt-1 bg-black border border-white/5 p-2 rounded-sm font-mono text-[9px] text-emerald-400 max-w-full overflow-x-auto whitespace-pre-wrap leading-tight">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'admins' && currentAdmin.role === 'super' && (
            <div className="space-y-6">
              <h3 className="font-serif italic text-lg text-[#e2cca8] tracking-widest mb-4"><Key className="inline mr-2 text-[#e2cca8]" size={15} /> Gestão Executiva e Administrativa</h3>

              {/* Register auxiliary administrator */}
              <form onSubmit={handleCreateAdmin} className="bg-[#050505] p-5 rounded-sm border border-white/10 space-y-4">
                <h4 className="font-serif italic text-xs text-[#e2cca8] tracking-widest border-b border-white/5 pb-2 flex items-center gap-1.5">Cadastrar Novo Administrator Auxiliar</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Nome Completo</label>
                    <input 
                      type="text" 
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="Nome oficial"
                      required
                      className="bg-black border border-white/10 rounded-sm py-2 px-3 text-xs text-white w-full font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Telefone (9 dígitos)</label>
                    <input 
                      type="tel" 
                      value={newAdminPhone}
                      onChange={(e) => setNewAdminPhone(e.target.value)}
                      placeholder="84XXXXXXX"
                      maxLength={15}
                      required
                      className="bg-black border border-white/10 rounded-sm py-2 px-3 text-xs text-white w-full font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">Senha (Mínimo 8 dígitos)</label>
                    <input 
                      type="password" 
                      value={newAdminPass}
                      onChange={(e) => setNewAdminPass(e.target.value)}
                      placeholder="Senha segura admin"
                      required
                      className="bg-black border border-white/10 rounded-sm py-2 px-3 text-xs text-white w-full font-mono focus:outline-none focus:border-[#c5a880]"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 w-full py-2.5 text-[10px] tracking-widest uppercase rounded-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus size={13} /> Registar Admin Auxiliar
                </button>
              </form>

              {/* Administrators list directory */}
              <div className="bg-[#050505] p-5 rounded-sm border border-white/10 space-y-3.5">
                <h4 className="font-serif italic text-xs text-[#e2cca8] tracking-widest border-b border-white/5 pb-2">Directório Executivo</h4>
                
                <div className="space-y-3">
                  {admins.map((adm) => (
                    <div key={adm.id} className="flex justify-between items-center p-3 rounded-sm bg-black border border-white/5 text-xs text-white">
                      <div>
                        <strong className="text-sm font-serif italic text-[#e2cca8]">{adm.name}</strong>
                        <span className="text-[10px] text-white/45 font-mono block mt-0.5">+258 {adm.phone} · Função: {adm.role === 'super' ? 'Sócio Integrante (Super)' : 'Moderador de Payout'}</span>
                        {adm.lastLoginAt && <span className="text-[9px] text-white/35 block mt-0.5">Último Login: {new Date(adm.lastLoginAt).toLocaleString('pt-MZ')}</span>}
                      </div>

                      {adm.role !== 'super' && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveAdmin(adm.id)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 p-2 rounded-sm cursor-pointer transition-colors"
                          title="Remover Administrador"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger zone complete wipe */}
              <div className="bg-rose-950/10 rounded-sm border border-rose-900/40 p-5 space-y-3">
                <div className="flex gap-2.5 items-center text-red-400">
                  <AlertTriangle size={15} />
                  <h4 className="font-serif italic text-xs tracking-wider uppercase text-rose-400">Zona de Extremo Perigo</h4>
                </div>
                <p className="text-[11px] text-rose-200/60 leading-relaxed font-light">
                  A acção abaixo apagará imediatamente todas as contas cadastradas, todo o histórico de transacções de MZN, comprovativos carregados e logs corporativos. Os planos VIP retornarão aos padrões de fábrica. Não há como estornar essa exclusão.
                </p>
                <div className="pt-2">
                  <button 
                    type="button" 
                    onClick={handleSelfDestruct}
                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 px-5 py-3 rounded-sm font-bold text-[10px] tracking-widest uppercase transition-colors cursor-pointer block text-center w-full sm:w-auto"
                  >
                    💥 Autodestruir Banco de Dados e Resetar Plataforma
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
