/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, TrendingUp, Users, Receipt, User as UserIcon, ShieldAlert, CheckCircle, 
  Clock, Plus, Download, Key, Info, HelpCircle, Phone, Lock, Eye, EyeOff, 
  Sparkles, FileText, Share2, Clipboard, ArrowRight, Activity, Crown, X
} from 'lucide-react';

import { User, VIPPlan, PlatformConfig, Transaction, TeamMember } from './types';
import { PersistenceManager } from './db';
import { fmt, validatePhone, hashPassword, generateUUID } from './utils';

// Import newly refactored subcomponents
import AuthScreen from './components/AuthScreen';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [initDone, setInitDone] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<'home' | 'invest' | 'team' | 'transactions' | 'profile' | 'about'>('home');
  const [modal, setModal] = useState<'recharge' | 'withdraw' | 'changepass' | 'investinfo' | null>(null);
  const [selectedVipInfo, setSelectedVipInfo] = useState<VIPPlan | null>(null);

  // Global Toast State
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  // Backdoor click counter state for Logo 5-taps
  const [logoTaps, setLogoTaps] = useState(0);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminSession, setAdminSession] = useState<any | null>(null);

  // Realtime countdown states for income collection faucet
  const [collectPendingAmount, setCollectPendingAmount] = useState(0);
  const [collectCanClaim, setCollectCanClaim] = useState(false);
  const [collectTimeRemainingMs, setCollectTimeRemainingMs] = useState(0);
  const [secondsCounter, setSecondsCounter] = useState(0);

  // Recharge modal fields
  const [rechargeAmt, setRechargeAmt] = useState('');
  const [rechargePhone, setRechargePhone] = useState('');
  const [proofFileBase64, setProofFileBase64] = useState<string | null>(null);
  const [proofFileName, setProofFileName] = useState('');

  // Withdraw modal fields
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');

  // Change password modal fields
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showNewPass2, setShowNewPass2] = useState(false);

  // Settings values loaded from LocalDB
  const [config, setConfig] = useState<PlatformConfig>(PersistenceManager.getConfig());
  const [vipPlans, setVipPlans] = useState<VIPPlan[]>(PersistenceManager.getVIPPlans());

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg(message);
    setToastType(type);
    setToastVisible(true);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
      osc.start();
      osc.stop(audioContext.currentTime + 0.3);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioContext.currentTime); // A3
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
      osc.start();
      osc.stop(audioContext.currentTime + 0.3);
    }
  };

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => {
        setToastVisible(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  // Initial startup routine
  useEffect(() => {
    const startup = async () => {
      await PersistenceManager.initialize();
      setInitDone(true);

      // Check existing active user session
      const storedActive = localStorage.getItem('htx_active_user_phone');
      if (storedActive) {
        const u = PersistenceManager.getUserByPhone(storedActive);
        if (u && !u.isBlocked) {
          setUser(u);
          setRechargePhone(u.phone);
          setWithdrawPhone(u.phone);
        } else {
          localStorage.removeItem('htx_active_user_phone');
        }
      }

      // Check existing active admin session
      const storedAdmin = sessionStorage.getItem('htx_active_admin');
      if (storedAdmin) {
        try {
          setAdminSession(JSON.parse(storedAdmin));
        } catch {
          sessionStorage.removeItem('htx_active_admin');
        }
      }

      setConfig(PersistenceManager.getConfig());
      setVipPlans(PersistenceManager.getVIPPlans());
    };
    startup();
  }, []);

  // Periodic collection timer calculation and user statistics synchronization
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsCounter((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recalculate collector state each second when counter updates or user switches
  useEffect(() => {
    if (!user) return;
    
    // Quick reload user details from LocalDB index regularly to absorb Approved deposits
    const freshUser = PersistenceManager.getUserByPhone(user.phone);
    if (freshUser) {
      if (JSON.stringify(freshUser) !== JSON.stringify(user)) {
        setUser(freshUser);
        setVipPlans(PersistenceManager.getVIPPlans());
        setConfig(PersistenceManager.getConfig());
      }
    }

    if (user.vipLevel === 0) {
      setCollectPendingAmount(0);
      setCollectCanClaim(false);
      setCollectTimeRemainingMs(0);
      return;
    }

    const currentVip = vipPlans.find((v) => v.level === user.vipLevel);
    if (!currentVip) return;

    const dailyProfit = user.customDailyProfit !== null && user.customDailyProfit !== undefined
      ? user.customDailyProfit
      : currentVip.dailyProfit;

    const now = Date.now();
    const activatedAt = user.vipActivatedAt ? new Date(user.vipActivatedAt).getTime() : new Date(user.createdAt).getTime();
    const lastCollect = user.lastCollectDate ? new Date(user.lastCollectDate).getTime() : activatedAt;

    const cycleMs = 24 * 60 * 60 * 1000;
    const timePassedMs = now - lastCollect;
    const cyclesCompleted = Math.floor(timePassedMs / cycleMs);

    if (cyclesCompleted >= 1) {
      setCollectCanClaim(true);
      setCollectPendingAmount(cyclesCompleted * dailyProfit);
      setCollectTimeRemainingMs(0);
    } else {
      setCollectCanClaim(false);
      setCollectPendingAmount(0);
      const nextCollectTime = lastCollect + cycleMs;
      setCollectTimeRemainingMs(Math.max(0, nextCollectTime - now));
    }
  }, [secondsCounter, user, vipPlans]);

  const refreshPlatformData = () => {
    setConfig(PersistenceManager.getConfig());
    setVipPlans(PersistenceManager.getVIPPlans());
    if (user) {
      const fresh = PersistenceManager.getUserByPhone(user.phone);
      if (fresh) setUser(fresh);
    }
  };

  const handleLogoTap = () => {
    const activeTaps = logoTaps + 1;
    setLogoTaps(activeTaps);
    
    if (activeTaps >= 5) {
      setLogoTaps(0);
      if (adminSession) {
        showToast('Painel Administrativo já autenticado.', 'info');
      } else {
        setShowAdminAuth(true);
        showToast('Backdoor Administrativo detetado. Insira as credenciais.', 'info');
      }
    }

    // Reset tap stream if inactive
    setTimeout(() => {
      setLogoTaps(0);
    }, 4000);
  };

  const handleAdminAuth = async (e: FormEvent) => {
    e.preventDefault();
    const cleanPh = adminPhone.replace(/\D/g, '');
    const adminsList = PersistenceManager.getAdmins();
    const adminInst = adminsList.find((a) => a.phone === cleanPh && a.isActive);

    if (!adminInst) {
      showToast('Nenhum administrador registado para este número de telefone.', 'error');
      PersistenceManager.writeAuditLog(null, null, 'failed_admin_login_wrong_phone', { phone: cleanPh });
      return;
    }

    const inputHash = await hashPassword(adminPass);
    if (inputHash !== adminInst.passwordHash) {
      showToast('Credenciais administrativas incorretas.', 'error');
      PersistenceManager.writeAuditLog(null, null, 'failed_admin_login_wrong_pass', { phone: cleanPh });
      return;
    }

    // Success Authentication
    const sessionObj = {
      id: adminInst.id,
      name: adminInst.name,
      phone: adminInst.phone,
      role: adminInst.role,
    };
    sessionStorage.setItem('htx_active_admin', JSON.stringify(sessionObj));
    setAdminSession(sessionObj);
    setShowAdminAuth(false);
    setAdminPhone('');
    setAdminPass('');
    showToast(`Bem-vindo, Administrador ${adminInst.name}!`, 'success');
  };

  const handleUserLogout = () => {
    localStorage.removeItem('htx_active_user_phone');
    PersistenceManager.writeAuditLog(null, user?.id || null, 'user_logout_session', {});
    setUser(null);
    setScreen('home');
    setModal(null);
    showToast('Sessão terminada.', 'info');
  };

  // Claim income accumulated in faucet
  const handleCollectIncome = () => {
    if (!user || user.vipLevel === 0) return;
    if (!collectCanClaim || collectPendingAmount <= 0) {
      showToast('Seu rendimento diário ainda está em processamento de ciclo.', 'error');
      return;
    }

    // Open lock transactionally
    const freshUser = PersistenceManager.getUserByPhone(user.phone);
    if (!freshUser) return;

    freshUser.balance += collectPendingAmount;
    freshUser.totalProfit += collectPendingAmount;
    freshUser.lastCollectDate = new Date().toISOString();

    const currentVip = vipPlans.find((v) => v.level === user.vipLevel);
    const dailyProfit = freshUser.customDailyProfit !== null && freshUser.customDailyProfit !== undefined
      ? freshUser.customDailyProfit
      : (currentVip?.dailyProfit || 0);

    const desc = `Coleta de Rendimento diário — Nível VIP ${freshUser.vipLevel} (${fmt(dailyProfit)} MT/dia)`;

    const collectTx: Transaction = {
      id: generateUUID(),
      type: 'profit',
      desc,
      amount: collectPendingAmount,
      status: 'completed',
      date: new Date().toISOString(),
    };

    freshUser.transactions.push(collectTx);
    PersistenceManager.saveUser(freshUser);
    setUser(freshUser);
    
    PersistenceManager.writeAuditLog(null, freshUser.id, 'collect_income_success', {
      amountClaimed: collectPendingAmount,
    });

    showToast(`Excelente! Coletados MZN ${fmt(collectPendingAmount)} com sucesso!`, 'success');
  };

  // Activate VIP purchasing flow
  const handleBuyVip = (plan: VIPPlan) => {
    if (!user) return;
    
    if (user.balance < plan.unlockCost) {
      showToast('Seu saldo disponível é insuficiente. Por favor, faça uma recarga via e-Mola.', 'error');
      setModal('recharge');
      setRechargeAmt(plan.unlockCost.toString());
      return;
    }

    const freshUser = PersistenceManager.getUserByPhone(user.phone);
    if (!freshUser) return;

    // Deduct cost and save
    freshUser.balance -= plan.unlockCost;
    freshUser.vipLevel = plan.level;
    freshUser.vipActivatedAt = new Date().toISOString();
    freshUser.lastCollectDate = null; // Fresh cycle begin!

    const tx: Transaction = {
      id: generateUUID(),
      type: 'profit', // treated as purchase fee
      desc: `Ativação de Plano de Investimento: VIP ${plan.level} — ${plan.name}`,
      amount: -plan.unlockCost,
      status: 'completed',
      date: new Date().toISOString(),
    };

    freshUser.transactions.push(tx);
    PersistenceManager.saveUser(freshUser);
    setUser(freshUser);

    PersistenceManager.writeAuditLog(null, freshUser.id, 'purchase_vip_plan', {
      level: plan.level,
      cost: plan.unlockCost,
    });

    setModal(null);
    showToast(`Parabéns! Ativou o VIP ${plan.level} — ${plan.name}! Seu rendimento diário de MZN ${fmt(plan.dailyProfit)} está ativo!`, 'success');
  };

  const handleDepositSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(rechargeAmt);
    const cleanPhone = rechargePhone.replace(/\D/g, '');

    if (isNaN(amountVal) || amountVal < 50) {
      showToast('O valor mínimo de carregamento é MZN 50,00.', 'error');
      return;
    }
    if (!validatePhone(cleanPhone)) {
      showToast('Insira um número de telefone moçambicano válido para os logs de suporte.', 'error');
      return;
    }
    if (!proofFileBase64) {
      showToast('Por favor, carregue o comprovativo da transferência para podermos confirmar.', 'error');
      return;
    }

    const freshUser = PersistenceManager.getUserByPhone(user!.phone);
    if (!freshUser) return;

    const newTxId = generateUUID();
    const tx: Transaction = {
      id: newTxId,
      type: 'recharge',
      desc: `Carregamento e-Mola — Aguardando Auditoria`,
      amount: amountVal,
      status: 'pending',
      date: new Date().toISOString(),
      payoutPhone: cleanPhone,
      proofUrl: proofFileBase64,
    };

    freshUser.transactions.push(tx);
    PersistenceManager.saveUser(freshUser);
    setUser(freshUser);

    PersistenceManager.writeAuditLog(null, freshUser.id, 'user_submit_recharge_request', {
      amount: amountVal,
      requestPhone: cleanPhone,
      txId: newTxId,
    });

    setModal(null);
    setRechargeAmt('');
    setProofFileBase64(null);
    setProofFileName('');
    showToast('Carregamento submetido! O Administrador analisará o comprovativo em breve.', 'success');
  };

  const handleWithdrawSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amtVal = parseFloat(withdrawAmt);
    const cleanPh = withdrawPhone.replace(/\D/g, '');

    // Operational requirements checks
    if (user!.vipLevel === 0) {
      showToast('Falta de permissões: Deve ativar no mínimo um Plano VIP para habilitar os levantamentos M-Pesa.', 'error');
      return;
    }

    const hours = { start: config.withdrawHourStart, end: config.withdrawHourEnd };
    const currentHour = new Date().getHours();
    if (currentHour < hours.start || currentHour >= hours.end) {
      showToast(`Levantamentos temporariamente indisponíveis. Tente novamente dentro do horário operacional: ${hours.start}:00h às ${hours.end}:00h.`, 'error');
      return;
    }

    if (isNaN(amtVal) || amtVal < 50) {
      showToast('O valor mínimo para saques M-Pesa é de MZN 50,00.', 'error');
      return;
    }
    if (amtVal > user!.balance) {
      showToast('Saldo insuficiente para retirar.', 'error');
      return;
    }
    if (!validatePhone(cleanPh)) {
      showToast('Número M-Pesa inválido para pagamento.', 'error');
      return;
    }

    // Limit saques cycle to once every 24h
    if (user!.lastWithdrawTs) {
      const msPassed = Date.now() - new Date(user!.lastWithdrawTs).getTime();
      const waitingMs = 24 * 60 * 60 * 1000;
      if (msPassed < waitingMs) {
        showToast('Por segurança, só é permitido realizar um levantamento M-Pesa a cada 24 horas.', 'error');
        return;
      }
    }

    const freshUser = PersistenceManager.getUserByPhone(user!.phone);
    if (!freshUser) return;

    // Deduct gross immediately during locking transition
    freshUser.balance -= amtVal;
    freshUser.lastWithdrawTs = new Date().toISOString();

    const wTxId = generateUUID();
    const tx: Transaction = {
      id: wTxId,
      type: 'withdraw',
      desc: `Levantamento M-Pesa — Comissão Admin de ${config.withdrawDiscountPct}%`,
      amount: -amtVal,
      status: 'pending',
      date: new Date().toISOString(),
      payoutPhone: cleanPh,
    };

    freshUser.transactions.push(tx);
    PersistenceManager.saveUser(freshUser);
    setUser(freshUser);

    PersistenceManager.writeAuditLog(null, freshUser.id, 'user_submit_withdraw_request', {
      grossAmount: amtVal,
      payoutPhone: cleanPh,
      taxPct: config.withdrawDiscountPct,
      txId: wTxId,
    });

    setModal(null);
    setWithdrawAmt('');
    showToast('Solicitação de transferência submetida! O processamento do M-Pesa leva em média 15-30 minutos.', 'success');
  };

  const handleChangePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass || !newPass2) {
      showToast('Preencha os campos obrigatórios.', 'error');
      return;
    }
    if (newPass !== newPass2) {
      showToast('As novas senhas digitadas não coincidem.', 'error');
      return;
    }
    if (newPass.length < 6) {
      showToast('A nova senha deve possuir pelo menos 6 caracteres.', 'error');
      return;
    }

    const freshUser = PersistenceManager.getUserByPhone(user!.phone);
    if (!freshUser) return;

    const oldHash = await hashPassword(oldPass);
    if (oldHash !== freshUser.passwordHash) {
      showToast('A senha atual inserida está incorreta.', 'error');
      return;
    }

    freshUser.passwordHash = await hashPassword(newPass);
    PersistenceManager.saveUser(freshUser);
    setUser(freshUser);

    PersistenceManager.writeAuditLog(null, freshUser.id, 'user_change_password', {});
    
    setModal(null);
    setOldPass('');
    setNewPass('');
    setNewPass2('');
    showToast('Sua senha de segurança foi alterada com sucesso!', 'success');
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Tamanho máximo do ficheiro excedido (limite de 5MB).', 'error');
      return;
    }

    setProofFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setProofFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Timer displays
  const getTimerString = () => {
    if (collectTimeRemainingMs <= 0) return 'Disponível!';
    const h = Math.floor(collectTimeRemainingMs / 3600000);
    const m = Math.floor((collectTimeRemainingMs % 3600000) / 60000);
    const s = Math.floor((collectTimeRemainingMs % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!initDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
        <div className="text-center space-y-4">
          <span className="w-10 h-10 border-4 border-[#c5a880]/20 border-t-[#c5a880] rounded-full animate-spin inline-block"></span>
          <p className="text-white/40 font-mono text-xs tracking-widest uppercase">A Inicializar HTX...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#050505] text-[#E5E5E5] flex items-center justify-center relative overflow-hidden">
        <AuthScreen 
          onLoginSuccess={(u) => {
            setUser(u);
            setRechargePhone(u.phone);
            setWithdrawPhone(u.phone);
            localStorage.setItem('htx_active_user_phone', u.phone);
          }} 
          toast={showToast} 
        />
        
        {/* Modal Admin authentication trigger backdoor */}
        <AnimatePresence>
          {showAdminAuth && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[999] flex items-center justify-center p-4">
              <motion.form 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleAdminAuth}
                className="bg-[#0d0d0d] border border-white/10 p-6 rounded-sm w-full max-w-sm text-white space-y-4 shadow-2xl"
              >
                <div>
                  <h3 className="font-serif italic text-base tracking-widest text-[#e2cca8]">🔑 ACESSO RESTRITO</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest leading-tight mt-1">Canal de segurança exclusivo para funcionários da rede HTX Moçambique.</p>
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Telefone Admin (sem +258)</label>
                  <input 
                    type="tel" 
                    value={adminPhone} 
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="84XXXXXXX" 
                    required 
                    className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Senha Secreta</label>
                  <input 
                    type="password" 
                    value={adminPass} 
                    onChange={(e) => setAdminPass(e.target.value)}
                    placeholder="Senha de acesso corporativa" 
                    required 
                    className="w-full bg-[#050505] border border-[#c5a880]/30 rounded-sm px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#c5a880]"
                  />
                </div>

                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    className="bg-[#c5a880] hover:bg-[#a18863] text-black text-xs font-bold tracking-widest uppercase py-3 rounded-sm cursor-pointer flex-1 transition-colors"
                  >
                    Entrar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowAdminAuth(false); showToast('Login cancelado', 'info'); }}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-bold tracking-widest uppercase py-3 rounded-sm cursor-pointer transition-colors px-4"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.form>
            </div>
          )}
        </AnimatePresence>

        {/* Global Floating Toast */}
        <AnimatePresence>
          {toastVisible && (
            <motion.div 
              initial={{ opacity: 0, y: -40, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -40, x: '-50%' }}
              className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-5 py-3 rounded-sm text-[10px] tracking-widest uppercase flex items-center gap-2 shadow-2xl border ${
                toastType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                toastType === 'error' ? 'bg-rose-500/10 text-rose-450 border-rose-500/20' : 'bg-[#0d0d0d] text-[#e2cca8] border-white/10'
              }`}
            >
              {toastType === 'success' && <CheckCircle size={14} />}
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    );
  }

  const currentVip = vipPlans.find((v) => v.level === user.vipLevel);
  const activeDailyProfit = user.customDailyProfit !== null && user.customDailyProfit !== undefined
    ? user.customDailyProfit
    : (currentVip?.dailyProfit || 0);

  return (
    <div className="min-h-screen bg-[#050505] text-[#E5E5E5] pb-24 max-w-sm sm:max-w-md mx-auto border-x border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.8)] relative overflow-x-hidden flex flex-col">
      
      {/* Header Container */}
      <header className="bg-[#0d0d0d] border-b border-white/10 p-5 text-white space-y-4 shadow-lg shrink-0">
        <div className="flex items-center justify-between">
          <div onClick={handleLogoTap} className="flex items-center gap-2.5 cursor-pointer hover:opacity-95 select-none active:scale-95 transition-all">
            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-xs serif-italic text-[#c5a880] italic bg-white/[0.02]">
              H
            </div>
            <div>
              <h1 className="font-serif italic text-lg leading-none tracking-widest text-[#e2cca8]">HTX</h1>
              <p className="text-[8px] text-white/40 block uppercase tracking-[0.25em] font-medium leading-none mt-1">Investimentos de Elite</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {adminSession && (
              <button 
                type="button" 
                onClick={() => setScreen('profile')} 
                className="bg-[#c5a880] hover:bg-[#a18863] text-black px-2.5 py-1.5 rounded-sm text-[9px] font-bold tracking-wider uppercase cursor-pointer"
              >
                ADMIN ATIVO
              </button>
            )}
            <div className="bg-emerald-500/5 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono tracking-wide flex items-center gap-1.5 leading-none uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-455 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span> Moçambique
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.2em] block mb-0.5">Investidor Associado</p>
            <h2 className="font-serif text-base italic text-white/90 truncate max-w-[170px] leading-tight">{user.name}</h2>
            <span className="text-[10px] text-white/30 font-mono tracking-wide block mt-1">+258 {user.phone}</span>
          </div>

          <div className="bg-[#c5a880]/5 border border-[#c5a880]/20 py-1.5 px-3 rounded-sm shrink-0 flex items-center gap-1.5 text-[#e2cca8] font-serif italic text-xs">
            <Crown size={12} className="text-[#c5a880]" /> {currentVip?.name || 'Iniciante'}
          </div>
        </div>
      </header>

      {/* Primary Dynamic Screen Navigator Panel */}
      <main className="flex-1 p-4 space-y-4">
        
        {screen === 'home' && (
          <div className="space-y-4">
            
            {/* Balance Card display */}
            <div className="bg-white/[0.02] border border-white/10 p-5 flex justify-between items-center relative overflow-hidden backdrop-blur-sm rounded-sm">
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Saldo Disponível</span>
                <span className="text-2xl font-serif text-white block leading-none">MZN {fmt(user.balance)}</span>
              </div>
              <div className="text-right space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Lucro Acumulado</span>
                <span className="text-base font-serif italic text-emerald-400 block leading-none">MZN {fmt(user.totalProfit)}</span>
              </div>
            </div>

            {/* Practical Navigation Buttons shortcuts */}
            <div className="grid grid-cols-4 gap-2">
              <button 
                type="button" 
                onClick={() => setModal('recharge')}
                className="bg-white/[0.02] hover:bg-white/[0.05] active:scale-95 transition-all p-3 border border-white/10 text-center space-y-2 cursor-pointer rounded-sm group font-sans"
              >
                <div className="w-9 h-9 border border-[#c5a880]/20 bg-[#c5a880]/5 text-[#e2cca8] rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-105"><Plus size={16} /></div>
                <span className="text-[9px] text-white/70 font-medium tracking-wider uppercase block">Recarga</span>
              </button>

              <button 
                type="button" 
                onClick={() => setModal('withdraw')}
                className="bg-white/[0.02] hover:bg-white/[0.05] active:scale-95 transition-all p-3 border border-white/10 text-center space-y-2 cursor-pointer rounded-sm group font-sans"
              >
                <div className="w-9 h-9 border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-105"><Download size={16} /></div>
                <span className="text-[9px] text-white/70 font-medium tracking-wider uppercase block">Levantar</span>
              </button>

              <button 
                type="button" 
                onClick={() => setScreen('invest')}
                className="bg-white/[0.02] hover:bg-white/[0.05] active:scale-95 transition-all p-3 border border-white/10 text-center space-y-2 cursor-pointer rounded-sm group font-sans"
              >
                <div className="w-9 h-9 border border-[#c5a880]/20 bg-[#c5a880]/5 text-[#e2cca8] rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-105"><TrendingUp size={16} /></div>
                <span className="text-[9px] text-white/70 font-medium tracking-wider uppercase block">Investir</span>
              </button>

              <button 
                type="button" 
                onClick={() => setScreen('team')}
                className="bg-white/[0.02] hover:bg-white/[0.05] active:scale-95 transition-all p-3 border border-white/10 text-center space-y-2 cursor-pointer rounded-sm group font-sans"
              >
                <div className="w-9 h-9 border border-white/5 bg-white/[0.02] text-white/65 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-105"><Users size={16} /></div>
                <span className="text-[9px] text-white/70 font-medium tracking-wider uppercase block">Equipa</span>
              </button>
            </div>

            {/* Income Collector faucet widget */}
            <div className="bg-white/[0.02] border border-white/10 p-5 rounded-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5 text-white">
                <span className="text-xs uppercase tracking-[0.2em] text-white/80 flex items-center gap-2"><Activity size={15} className="text-[#c5a880]" /> Coleta Diária de Renda</span>
                <span className="text-[10px] font-mono text-white/40">MZN {fmt(activeDailyProfit)}/dia</span>
              </div>

              {user.vipLevel === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[11px] text-white/50 leading-relaxed italic serif-italic">Não possui nenhum plano comercial ativo de momento.</p>
                  <button 
                    type="button" 
                    onClick={() => setScreen('invest')}
                    className="mt-4 px-6 py-2.5 border border-[#c5a880]/30 bg-[#c5a880]/5 hover:bg-[#c5a880]/15 text-[#e2cca8] text-[10px] font-bold tracking-widest uppercase rounded-sm transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    Ativar Plano de Renda <ArrowRight size={13} />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <span className="text-2xl font-serif text-emerald-400 block font-medium">MZN {fmt(collectPendingAmount)}</span>
                    <span className="text-[9px] uppercase tracking-widest text-[#e2cca8] block mt-1">Acumulado Disponível</span>
                  </div>

                  <div className="bg-white/[0.01] border border-white/5 rounded-sm p-3 flex items-center justify-between">
                    <span className="text-[10px] text-white/45 uppercase tracking-wider flex items-center gap-1.5"><Clock size={13} className="text-[#c5a880]" /> Próxima Liberação:</span>
                    <span className="text-xs font-mono text-[#c5a880] py-0.5 px-3 rounded-full bg-[#c5a880]/5 border border-[#c5a880]/15">{getTimerString()}</span>
                  </div>

                  <button 
                    type="button" 
                    disabled={!collectCanClaim}
                    onClick={handleCollectIncome}
                    className={`w-full py-3.5 rounded-sm text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
                      collectCanClaim 
                        ? 'bg-[#c5a880] hover:bg-[#a18863] text-black font-bold' 
                        : 'bg-white/10 text-white/30 border border-white/5 pointer-events-none'
                    }`}
                  >
                    {collectCanClaim ? 'Coletar Rendimento' : 'Aguardar Próximo Ciclo 24h'}
                  </button>
                </div>
              )}
            </div>

            {/* Quick brief recent transaction lists */}
            <div className="bg-white/[0.02] border border-white/10 p-5 rounded-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-white/80">Transações Recentes</span>
                <button type="button" onClick={() => setScreen('transactions')} className="text-[10px] uppercase tracking-widest text-[#e2cca8] hover:text-white transition-colors cursor-pointer">Ver Histórico</button>
              </div>

              {user.transactions?.length === 0 ? (
                <div className="text-center py-4 text-white/30 text-xs serif-italic">Nenhum registo financeiro registado.</div>
              ) : (
                <div className="space-y-3">
                  {user.transactions.slice(-3).reverse().map((t) => (
                    <div key={t.id} className="flex justify-between items-center p-3 rounded-sm bg-white/[0.01] border border-white/5 transition-colors hover:bg-white/[0.02]">
                      <div className="space-y-1">
                        <strong className="block text-xs text-white/90 font-medium font-serif italic mb-0.5">{t.desc}</strong>
                        <span className="text-[9px] font-mono text-white/40 block">{new Date(t.date).toLocaleDateString()}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold shrink-0 ml-1.5 ${t.amount >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                        {t.amount >= 0 ? '+' : ''}MZN {fmt(Math.abs(t.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'invest' && (
          <div className="space-y-4">
            <div className="pb-1">
              <h3 className="font-serif italic text-lg text-white leading-none tracking-widest uppercase">Planos de Rendimento</h3>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1 font-medium">Ative uma licença comercial e lucre a cada 24 horas.</p>
            </div>

            <div className="space-y-5">
              {vipPlans.filter((p) => p.level > 0).map((v) => {
                const owned = user.vipLevel >= v.level;
                const profitRate = user.customDailyProfit !== null && user.customDailyProfit !== undefined && owned
                  ? user.customDailyProfit
                  : v.dailyProfit;

                return (
                  <div key={v.level} className="bg-[#090909] rounded-sm overflow-hidden border border-white/10 shadow-2xl flex flex-col hover:border-[#c5a880]/30 transition-all duration-300 group">
                    <div className="h-38 bg-black/60 relative overflow-hidden flex items-center justify-center border-b border-white/5">
                      {v.image ? (
                        <>
                          <img 
                            src={v.image} 
                            alt={v.name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-80" />
                        </>
                      ) : (
                        <span className="text-5xl opacity-80">{v.emoji}</span>
                      )}
                      
                      <div className="absolute top-3 right-3 bg-[#050505]/80 backdrop-blur-sm border border-white/10 text-white font-serif italic text-[10px] uppercase py-1 px-3 rounded-sm tracking-wider">
                        VIP {v.level}
                      </div>

                      <div className="absolute bottom-3 left-4 text-white z-10">
                        <h4 className="font-serif italic text-base tracking-widest text-[#e2cca8]">{v.name}</h4>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white/[0.01] border border-white/5 p-2 rounded-sm">
                          <span className="text-[9px] text-white/40 block font-normal uppercase tracking-wider mb-0.5">Custo</span>
                          <span className="text-xs font-mono font-bold text-white/95">MZN {fmt(v.unlockCost)}</span>
                        </div>
                        <div className="bg-white/[0.01] border border-white/5 p-2 rounded-sm">
                          <span className="text-[9px] text-[#e2cca8]/50 block font-normal uppercase tracking-wider mb-0.5">Lucro Diário</span>
                          <span className="text-xs font-mono font-bold text-[#e2cca8]">MZN {fmt(profitRate)}</span>
                        </div>
                        <div className="bg-white/[0.01] border border-white/5 p-2 rounded-sm">
                          <span className="text-[9px] text-emerald-450/40 block font-normal uppercase tracking-wider mb-0.5">Período</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 block">{v.days} dias</span>
                        </div>
                      </div>

                      {owned ? (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-center py-2.5 rounded-sm text-[10px] tracking-widest uppercase font-serif italic">
                          Plano já Ativado
                        </div>
                      ) : (
                        <button 
                          type="button" 
                          onClick={() => {
                            setSelectedVipInfo(v);
                            setModal('investinfo');
                          }}
                          className="w-full py-3.5 bg-[#c5a880] hover:bg-[#a18863] text-black font-semibold text-[10px] tracking-widest uppercase rounded-sm transition-colors cursor-pointer block text-center"
                        >
                          Adquirir por MZN {fmt(v.unlockCost)}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {screen === 'team' && (
          <div className="space-y-4">
            <div className="bg-white/[0.02] border border-white/10 p-5 rounded-sm text-white space-y-4 shadow-lg">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-[#e2cca8] block">Seu Código de Indicação</span>
                <div className="flex items-center justify-between mt-1 border-b border-white/5 pb-2.5">
                  <span className="font-mono font-bold text-2xl tracking-[0.2em] text-[#e2cca8]">{user.referralCode}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(user.referralCode);
                      showToast('Código de indicação copiado!', 'success');
                    }}
                    className="bg-white/[0.04] hover:bg-white/10 p-2.5 rounded-sm border border-white/10 text-white flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Clipboard size={15} />
                  </button>
                </div>
              </div>
              <p className="text-[11px] font-light leading-relaxed text-white/70 italic serif-italic">
                🎁 Ganhe bónus de rede convidando os seus conhecidos. Recebe instantaneamente <strong className="text-emerald-400">10%</strong> do montante integral de recarga inicial que cada afiliado seu registar.
              </p>
            </div>

            {/* Referral system grid specs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.02] rounded-sm p-4 border border-white/10 text-center shadow-sm">
                <span className="text-[9px] text-white/40 font-normal uppercase tracking-wider block mb-1">Membros Indicados</span>
                <span className="text-xl font-mono font-bold text-white">{user.team?.length || 0}</span>
              </div>
              <div className="bg-white/[0.02] rounded-sm p-4 border border-white/10 text-center shadow-sm">
                <span className="text-[9px] text-[#e2cca8]/55 font-normal uppercase tracking-wider block mb-1">Indicadores Ativos</span>
                <span className="text-xl font-mono font-bold text-[#e2cca8]">{user.team?.filter((m) => m.firstDepositAt).length || 0}</span>
              </div>
            </div>

            {/* Referrals list */}
            <div className="bg-white/[0.02] rounded-sm p-5 border border-white/10 shadow-lg space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-white/50 border-b border-white/5 pb-2.5 flex items-center gap-2">📋 Diretório da Equipa indicadora</h4>
              {(!user.team || user.team.length === 0) ? (
                <div className="text-center py-6 text-white/30 text-xs italic serif-italic">Ainda não possui indicados cadastrados com seu canal.</div>
              ) : (
                <div className="space-y-3 pr-1">
                  {user.team.map((m) => (
                    <div key={m.phone} className="flex justify-between items-center p-3 rounded-sm bg-white/[0.01] border border-white/5 text-xs text-white/80">
                      <div>
                        <strong className="block text-white/95 font-mono">+258 ***{m.phone.slice(-4)}</strong>
                        <span className="text-[9px] text-white/40 block">Afiliado em: {new Date(m.joinedAt).toLocaleDateString()}</span>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-widest inline-block rounded-sm py-0.5 px-2.5 border ${m.firstDepositAt ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/5'}`}>
                        {m.firstDepositAt ? 'Concluido' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'transactions' && (
          <div className="space-y-4">
            <div className="pb-1">
              <h3 className="font-serif italic text-lg text-white tracking-widest uppercase">Histórico Financeiro</h3>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Acompanhe todos os movimentos e fluxos de caixa da conta.</p>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-sm p-5 shadow-lg space-y-3.5">
              {(!user.transactions || user.transactions.length === 0) ? (
                <div className="text-center py-8 text-white/30 text-xs italic serif-italic">Falta de registos monetários anteriores na conta.</div>
              ) : (
                <div className="space-y-3">
                  {user.transactions.slice().reverse().map((t) => (
                    <div key={t.id} className="p-3.5 rounded-sm bg-white/[0.01] border border-white/5 flex justify-between items-start gap-4">
                      <div>
                        <strong className="block text-xs leading-tight text-white/90 font-medium font-serif italic mb-1">{t.desc}</strong>
                        <span className="text-[9px] text-white/40 font-mono block mb-1">ID: {t.id.substring(0, 8)} | {new Date(t.date).toLocaleString()}</span>
                        <div className="flex items-center gap-1.5 mt-1.5 leading-none">
                          <span className={`text-[9px] font-bold uppercase tracking-widest rounded-sm px-2 py-0.5 border ${
                            t.status === 'completed' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 
                            t.status === 'rejected' ? 'bg-rose-550/5 text-rose-450 border-rose-500/20' : 'bg-[#c5a880]/5 text-[#c5a880] border-[#c5a880]/20'
                          }`}>
                            {t.status === 'completed' ? 'Sucesso' : t.status === 'rejected' ? 'Rejeitado' : 'Auditoria'}
                          </span>
                        </div>
                      </div>

                      <span className={`text-xs font-mono font-bold shrink-0 block text-right leading-none ${t.amount >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                        {t.amount >= 0 ? '+' : ''}MZN {fmt(Math.abs(t.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'profile' && (
          <div className="space-y-4">
            
            {/* User identification badge */}
            <div className="bg-white/[0.02] rounded-sm p-5 border border-white/10 shadow-lg flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border border-[#c5a880]/30 bg-[#c5a880]/5 text-[#e2cca8] flex items-center justify-center text-lg font-serif italic shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <h4 className="font-serif italic text-base text-white/90 leading-tight">{user.name}</h4>
                <span className="text-[10px] text-white/40 font-mono tracking-wider block font-medium">+258 {user.phone}</span>
                <span className="inline-block mt-2 bg-[#c5a880]/5 text-[#e2cca8] font-serif text-[10px] italic py-0.5 px-2.5 rounded-sm border border-[#c5a880]/20">
                  {currentVip?.name || 'Iniciante'}
                </span>
              </div>
            </div>

            {/* Quick action triggers */}
            <div className="bg-white/[0.02] border border-white/10 rounded-sm p-5 shadow-lg space-y-1">
              <button 
                type="button" 
                onClick={() => setModal('recharge')}
                className="w-full flex items-center justify-between py-3.5 text-[10px] uppercase font-medium tracking-wider text-white/70 hover:text-white border-b border-white/5 cursor-pointer"
              >
                <span>💳 Recarregar e-Mola</span>
                <ArrowRight size={13} className="text-[#c5a880]" />
              </button>

              <button 
                type="button" 
                onClick={() => setModal('withdraw')}
                className="w-full flex items-center justify-between py-3.5 text-[10px] uppercase font-medium tracking-wider text-white/70 hover:text-white border-b border-white/5 cursor-pointer"
              >
                <span>💸 Levantamento M-Pesa</span>
                <ArrowRight size={13} className="text-[#c5a880]" />
              </button>

              <button 
                type="button" 
                onClick={() => setModal('changepass')}
                className="w-full flex items-center justify-between py-3.5 text-[10px] uppercase font-medium tracking-wider text-white/70 hover:text-white border-b border-white/5 cursor-pointer"
              >
                <span>🔑 Alterar Senha Cadastrada</span>
                <ArrowRight size={13} className="text-[#c5a880]" />
              </button>

              <button 
                type="button" 
                onClick={() => setScreen('about')}
                className="w-full flex items-center justify-between py-3.5 text-[10px] uppercase font-medium tracking-wider text-white/70 hover:text-white border-b border-white/5 cursor-pointer"
              >
                <span>ℹ️ Sobre a HTX Moçambique</span>
                <ArrowRight size={13} className="text-[#c5a880]" />
              </button>

              {adminSession && (
                <button 
                  type="button" 
                  onClick={() => setShowAdminAuth(true)}
                  className="w-full flex items-center justify-between py-3.5 text-[10px] uppercase font-medium tracking-wider text-[#e2cca8] hover:text-white border-b border-white/5 cursor-pointer"
                >
                  <span>🛡️ Abrir Administrador Suite</span>
                  <ArrowRight size={13} className="text-[#e2cca8]" />
                </button>
              )}

              <button 
                type="button" 
                onClick={handleUserLogout}
                className="w-full flex items-center justify-between py-3.5 text-[10px] uppercase font-medium tracking-wider text-rose-450 hover:text-rose-350 cursor-pointer"
              >
                <span>🚪 Terminar Sessão</span>
                <ArrowRight size={13} className="text-rose-450" />
              </button>
            </div>
          </div>
        )}

        {screen === 'about' && (
          <div className="bg-[#0d0d0d] rounded-sm p-5 border border-white/10 shadow-lg space-y-4">
            <div className="text-center">
              <div className="w-11 h-11 rounded-full border border-[#c5a880]/30 bg-[#c5a880]/5 text-[#e2cca8] flex items-center justify-center mx-auto mb-2 text-sm font-serif italic">
                HTX
              </div>
              <h3 className="font-serif italic text-lg text-white">HTX Investimentos</h3>
              <p className="text-[9px] uppercase tracking-widest text-[#e2cca8] mt-1 font-semibold">Fintech de Moçambique</p>
            </div>

            <p className="text-xs text-white/60 leading-relaxed font-light">
              A HTX é uma fintech inovadora desenvolvida localmente com o intuito de democratizar o acesso e o conhecimento de produtos de rendimento digital em Moçambique de modo altamente exclusive.
            </p>

            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-sm text-white/50 space-y-2">
              <span className="text-[10px] uppercase font-medium tracking-wider block text-[#e2cca8]">Diretrizes de Suporte:</span>
              <p className="text-xs font-mono leading-relaxed">
                Carteira: e-Mola ({config.emolaNumber})<br />
                Processamento: M-Pesa de Saída<br />
                Horário Operacional: {config.withdrawHourStart}:00h às {config.withdrawHourEnd}:00h
              </p>
            </div>

            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => window.open(`https://wa.me/${config.whatsappNumber}?text=Olá%20HTX%20suporte`, '_blank')}
                className="flex-1 py-3 bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] tracking-widest uppercase font-bold rounded-sm transition-colors cursor-pointer text-center"
              >
                WhatsApp
              </button>
              {config.telegramLink && (
                <a 
                  href={config.telegramLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 py-3 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white text-[10px] tracking-widest uppercase font-bold rounded-sm transition-colors text-center block"
                >
                  Telegram
                </a>
              )}
            </div>
            
            <button 
              type="button" 
              onClick={() => setScreen('profile')} 
              className="w-full py-2.5 rounded-sm border border-white/10 text-white/50 hover:text-white bg-white/[0.01] text-[10px] tracking-widest uppercase text-center cursor-pointer"
            >
              Voltar ao Perfil
            </button>
          </div>
        )}
      </main>

      {/* Global Navigation Footer menu */}
      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-sm sm:max-w-md w-full bg-[#0d0d0d]/95 backdrop-blur-md border-t border-[#ffffff]/10 grid grid-cols-5 p-1.5 shadow-2xl z-[800]">
        <button 
          type="button" 
          onClick={() => { setScreen('home'); setModal(null); }}
          className={`py-2 rounded-sm flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all ${screen === 'home' ? 'text-[#e2cca8] bg-white/[0.03]' : 'text-white/40 hover:text-white/70'}`}
        >
          <Home size={15} />
          <span className="text-[9px] uppercase tracking-wider">Início</span>
        </button>

        <button 
          type="button" 
          onClick={() => { setScreen('invest'); setModal(null); }}
          className={`py-2 rounded-sm flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all ${screen === 'invest' ? 'text-[#e2cca8] bg-white/[0.03]' : 'text-white/40 hover:text-white/70'}`}
        >
          <TrendingUp size={15} />
          <span className="text-[9px] uppercase tracking-wider">Invest</span>
        </button>

        <button 
          type="button" 
          onClick={() => { setScreen('team'); setModal(null); }}
          className={`py-2 rounded-sm flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all ${screen === 'team' ? 'text-[#e2cca8] bg-white/[0.03]' : 'text-white/40 hover:text-white/70'}`}
        >
          <Users size={15} />
          <span className="text-[9px] uppercase tracking-wider">Equipa</span>
        </button>

        <button 
          type="button" 
          onClick={() => { setScreen('transactions'); setModal(null); }}
          className={`py-2 rounded-sm flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all ${screen === 'transactions' ? 'text-[#e2cca8] bg-white/[0.03]' : 'text-white/40 hover:text-white/70'}`}
        >
          <Receipt size={15} />
          <span className="text-[9px] uppercase tracking-wider">Extrato</span>
        </button>

        <button 
          type="button" 
          onClick={() => { setScreen('profile'); setModal(null); }}
          className={`py-2 rounded-sm flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all ${screen === 'profile' ? 'text-[#e2cca8] bg-white/[0.03]' : 'text-white/40 hover:text-white/70'}`}
        >
          <UserIcon size={15} />
          <span className="text-[9px] uppercase tracking-wider">Perfil</span>
        </button>
      </footer>

      {/* Global Modals Overlays */}
      <AnimatePresence>
        
        {/* RECHARGE MODAL */}
        {modal === 'recharge' && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[850] flex items-end sm:items-center justify-center p-4">
            <motion.form 
              initial={{ opacity: 0, y: 50 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 50 }}
              onSubmit={handleDepositSubmit}
              className="bg-[#0d0d0d] border border-white/10 rounded-sm w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto text-[#E5E5E5]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h3 className="font-serif italic text-base text-white">Carregamento e-Mola</h3>
                <button type="button" onClick={() => setModal(null)} className="text-white/40 hover:text-white p-1.5 hover:bg-white/5 rounded-sm transition-colors cursor-pointer"><X size={15} /></button>
              </div>

              <div className="bg-[#c5a880]/5 border border-[#c5a880]/15 p-4 rounded-sm space-y-2 text-[#e2cca8]">
                <span className="text-[9px] uppercase tracking-widest text-[#c5a880] block font-semibold">Instrução Carteira e-Mola</span>
                <p className="text-[11px] leading-relaxed text-white/70 font-light">
                  Realize uma transferência de fundos e-Mola para o número abaixo correspondente à nossa rede de depósito:
                </p>
                <div className="flex items-center justify-between bg-black/40 border border-white/15 p-2 rounded-sm mt-1.5 align-middle">
                  <span className="font-mono font-bold text-base text-[#e2cca8] tracking-widest">{config.emolaNumber}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(config.emolaNumber);
                      showToast('Número e-Mola copiado!', 'success');
                    }}
                    className="p-1 px-3 bg-[#c5a880] text-black text-[9px] tracking-widest uppercase font-bold rounded-sm hover:opacity-90 transition-opacity cursor-pointer inline-block"
                  >
                    COPIAR
                  </button>
                </div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider block leading-tight mt-1">Nome Beneficiário: <strong className="text-white/80">{config.emolaName}</strong></div>
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Valor a Carregar (MZN)</label>
                <input 
                  type="number" 
                  value={rechargeAmt}
                  onChange={(e) => setRechargeAmt(e.target.value)}
                  placeholder="Min: 50 | Ex: 1300"
                  required
                  min={50}
                  className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs tracking-wide focus:outline-none focus:border-[#c5a880] transition-colors text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Seu Telefone Depositante (sem +258)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-mono border-r pr-2 leading-none border-white/10">+258</span>
                  <input 
                    type="tel" 
                    value={rechargePhone}
                    onChange={(e) => setRechargePhone(e.target.value)}
                    placeholder="84XXXXXXX"
                    required
                    className="w-full bg-[#050505] border border-white/10 rounded-sm pl-16 pr-4 py-3 text-xs tracking-wide focus:outline-none focus:border-[#c5a880] transition-colors text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Carregar Comprovativo de Transferência</label>
                <div className="relative cursor-pointer bg-white/[0.01] border border-dashed border-white/15 hover:border-[#c5a880] p-4 rounded-sm text-center">
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    required
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-1">
                    <span className="text-white/60 block text-xs">{proofFileName ? `Ficheiro: ${proofFileName}` : 'Anexar Foto do Comprovativo'}</span>
                    <span className="text-[9px] text-white/30 block tracking-wider uppercase font-light">Formatos: JPG, PNG, PDF (Limite: 5MB)</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit" 
                  className="bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] tracking-widest uppercase font-bold py-3.5 rounded-sm cursor-pointer flex-1 transition-colors block text-center font-sans"
                >
                  Confirmar Envio
                </button>
                <button 
                  type="button" 
                  onClick={() => setModal(null)}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[10px] tracking-widest uppercase font-bold py-3.5 rounded-sm cursor-pointer px-4 transition-colors block text-center font-sans"
                >
                  Voltar
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {/* WITHDRAW MODAL */}
        {modal === 'withdraw' && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[850] flex items-end sm:items-center justify-center p-4">
            <motion.form 
              initial={{ opacity: 0, y: 50 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 50 }}
              onSubmit={handleWithdrawSubmit}
              className="bg-[#0d0d0d] border border-white/10 rounded-sm w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto text-[#E5E5E5]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h3 className="font-serif italic text-base text-white">Levantamento M-Pesa</h3>
                <button type="button" onClick={() => setModal(null)} className="text-white/40 hover:text-white p-1.5 hover:bg-white/5 rounded-sm transition-colors cursor-pointer"><X size={15} /></button>
              </div>

              {/* Tax calculations info */}
              <div className="bg-white/[0.01] border border-white/10 p-3.5 rounded-sm text-xs space-y-1.5 text-white/60">
                <div className="flex justify-between">
                  <span>Taxa de Levantamento ({config.withdrawDiscountPct}%):</span>
                  <span className="text-rose-400 font-mono">
                    {withdrawAmt ? `MZN ${fmt(parseFloat(withdrawAmt) * (config.withdrawDiscountPct / 100))}` : `MZN 0,00`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1.5 text-sm text-[#e2cca8]">
                  <span>Líquido Creditado:</span>
                  <strong className="text-emerald-400 font-mono">
                    {withdrawAmt ? `MZN ${fmt(parseFloat(withdrawAmt) - parseFloat(withdrawAmt) * (config.withdrawDiscountPct / 100))}` : `MZN 0,00`}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Valor a Retirar (MZN)</label>
                <input 
                  type="number" 
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                  placeholder={`Min: 50 | Máximo: ${fmt(user.balance)}`}
                  required
                  min={50}
                  className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Número Recebedor M-Pesa (sem +258)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-mono border-r pr-2 leading-none border-white/10">+258</span>
                  <input 
                    type="tel" 
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    placeholder="84XXXXXXX"
                    required
                    className="w-full bg-[#050505] border border-white/10 rounded-sm pl-16 pr-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit" 
                  className="bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] tracking-widest uppercase font-bold py-3.5 rounded-sm cursor-pointer flex-1 transition-colors block text-center font-sans"
                >
                  Solicitar Transferência
                </button>
                <button 
                  type="button" 
                  onClick={() => setModal(null)}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[10px] tracking-widest uppercase font-bold py-3.5 rounded-sm cursor-pointer px-4 transition-colors block text-center font-sans"
                >
                  Voltar
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {/* CHANGE PASSWORD MODAL */}
        {modal === 'changepass' && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[850] flex items-end sm:items-center justify-center p-4">
            <motion.form 
              initial={{ opacity: 0, y: 50 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 50 }}
              onSubmit={handleChangePasswordSubmit}
              className="bg-[#0d0d0d] border border-white/10 rounded-sm w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto text-[#E5E5E5]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h3 className="font-serif italic text-base text-white">Mudar Senha</h3>
                <button type="button" onClick={() => setModal(null)} className="text-white/40 hover:text-white p-1.5 hover:bg-white/5 rounded-sm transition-colors cursor-pointer"><X size={15} /></button>
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Senha de Segurança Anterior</label>
                <div className="relative">
                  <input 
                    type={showOldPass ? 'text' : 'password'} 
                    value={oldPass}
                    onChange={(e) => setOldPass(e.target.value)}
                    placeholder="Sua senha de acesso atual"
                    required
                    className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer select-none"
                  >
                    {showOldPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Nova Senha</label>
                <div className="relative">
                  <input 
                    type={showNewPass ? 'text' : 'password'} 
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer select-none"
                  >
                    {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Confirmar Nova Senha</label>
                <div className="relative">
                  <input 
                    type={showNewPass2 ? 'text' : 'password'} 
                    value={newPass2}
                    onChange={(e) => setNewPass2(e.target.value)}
                    placeholder="Confirme a nova senha de segurança"
                    required
                    className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPass2(!showNewPass2)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer select-none"
                  >
                    {showNewPass2 ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 font-sans overflow-hidden">
                <button 
                  type="submit" 
                  className="bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] tracking-widest uppercase font-bold py-3.5 rounded-sm cursor-pointer flex-1 transition-colors block text-center"
                >
                  Atualizar Senha
                </button>
                <button 
                  type="button" 
                  onClick={() => setModal(null)}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[10px] tracking-widest uppercase font-bold py-3.5 rounded-sm cursor-pointer px-4 transition-colors block text-center"
                >
                  Voltar
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {/* INVEST PLAN PURCHASE MODAL SPECIFIC */}
        {modal === 'investinfo' && selectedVipInfo && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[850] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 50 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 50 }}
              className="bg-[#0d0d0d] border border-white/10 rounded-sm w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 text-[#E5E5E5]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h3 className="font-serif italic text-base text-white">Confirmar Investimento</h3>
                <button type="button" onClick={() => setModal(null)} className="text-white/40 hover:text-white p-1.5 hover:bg-white/5 rounded-sm transition-colors cursor-pointer"><X size={15} /></button>
              </div>

              <div className="text-center py-2 shrink-0">
                <span className="text-5xl block mb-2 opacity-90">{selectedVipInfo.emoji}</span>
                <span className="text-[9px] text-[#e2cca8] uppercase tracking-widest block font-bold">Nível {selectedVipInfo.level}</span>
                <h4 className="font-serif italic text-lg text-white mt-1 leading-none">{selectedVipInfo.name}</h4>
              </div>

              <div className="bg-white/[0.01] rounded-sm p-4 border border-white/5 text-xs space-y-2 text-white/70">
                <div className="flex justify-between"><span>Custo de Ativação:</span><strong className="text-white font-mono">MZN {fmt(selectedVipInfo.unlockCost)}</strong></div>
                <div className="flex justify-between border-t border-white/5 pt-1.5"><span>Renda Diária Garantida:</span><strong className="text-[#e2cca8] font-mono">MZN {fmt(selectedVipInfo.dailyProfit)}</strong></div>
                <div className="flex justify-between border-t border-white/5 pt-1.5"><span>Duração do Contrato:</span><strong className="text-white font-mono">{selectedVipInfo.days} dias</strong></div>
                <div className="flex justify-between border-t border-white/5 pt-1.5 text-sm text-[#e2cca8]"><span>Rendimento Estimado Total:</span><strong className="text-emerald-400 font-mono font-bold">MZN {fmt(selectedVipInfo.dailyProfit * selectedVipInfo.days)}</strong></div>
              </div>

              <div className="flex gap-2 pt-2 font-sans">
                <button 
                  type="button" 
                  onClick={() => handleBuyVip(selectedVipInfo)}
                  className="bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] tracking-widest uppercase font-bold py-3.5 rounded-sm cursor-pointer flex-1 transition-colors block text-center"
                >
                  Ativar Licença
                </button>
                <button 
                  type="button" 
                  onClick={() => setModal(null)}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[10px] tracking-widest uppercase font-bold py-3.5 rounded-sm cursor-pointer px-4 transition-colors block text-center"
                >
                  Voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel suite router */}
      <AnimatePresence>
        {adminSession && screen === 'profile' && (
          <AdminPanel 
            currentAdmin={adminSession} 
            onClose={() => setAdminSession(null)} 
            toast={showToast} 
            onUpdatePlatform={refreshPlatformData}
          />
        )}
      </AnimatePresence>

      {/* Global Iframe Floating Toast */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div 
            initial={{ opacity: 0, y: -40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -40, x: '-50%' }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-5 py-3 rounded-sm text-[10px] tracking-widest uppercase flex items-center gap-2 shadow-2xl border ${
              toastType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
              toastType === 'error' ? 'bg-rose-500/10 text-rose-450 border-rose-500/20' : 'bg-[#0d0d0d] text-[#e2cca8] border-white/10'
            }`}
          >
            {toastType === 'success' && <CheckCircle size={14} />}
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
