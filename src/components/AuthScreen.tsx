import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Phone, Lock, User as UserIcon, Shield, Gift, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { validateName, validatePhone, validatePassword, hashPassword, generateRefCode, generateUUID } from '../utils';
import { PersistenceManager } from '../db';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
  toast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function AuthScreen({ onLoginSuccess, toast }: AuthScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login Form States
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  
  // Register Form States
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPass2, setRegPass2] = useState('');
  const [regRef, setRegRef] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegPass2, setShowRegPass2] = useState(false);
  const [loading, setLoading] = useState(false);

  // Rate-limiting tracking (local state)
  const [attempts, setAttempts] = useState<{ [phone: string]: number[] }>({});

  const checkRateLimit = (phone: string): string | null => {
    const now = Date.now();
    const timestamps = attempts[phone] || [];
    // 15-minute window filter
    const activeAttempts = timestamps.filter((t) => now - t < 15 * 60 * 1000);
    
    if (activeAttempts.length >= 5) {
      const waitMinutes = Math.ceil((15 * 60 * 1000 - (now - activeAttempts[0])) / 60000);
      return `Muitas tentativas. Aguarde mais ${waitMinutes} minutos por segurança.`;
    }
    
    setAttempts({
      ...attempts,
      [phone]: [...activeAttempts, now],
    });
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = loginPhone.replace(/\D/g, '');
    
    if (!validatePhone(cleanPhone)) {
      toast('Número de telefone inválido. Use o padrão moçambicano 82/83/84/85/86/87 + 7 dígitos.', 'error');
      return;
    }
    if (!loginPass) {
      toast('Insira a sua senha.', 'error');
      return;
    }

    const rateError = checkRateLimit(cleanPhone);
    if (rateError) {
      toast(rateError, 'error');
      return;
    }

    setLoading(true);
    try {
      const user = PersistenceManager.getUserByPhone(cleanPhone);
      if (!user) {
        toast('Telefone ou senha incorretos.', 'error');
        setLoading(false);
        return;
      }

      if (user.isBlocked) {
        toast('Sua conta foi suspensa temporariamente. Entre em contato com o suporte.', 'error');
        setLoading(false);
        return;
      }

      const inputHash = await hashPassword(loginPass);
      if (inputHash !== user.passwordHash) {
        toast('Telefone ou senha incorretos.', 'error');
        setLoading(false);
        return;
      }

      // Success
      PersistenceManager.writeAuditLog(null, user.id, 'user_login', { phone: cleanPhone });
      onLoginSuccess(user);
      toast(`Bem-vindo de volta, ${user.name.split(' ')[0]}!`, 'success');
    } catch {
      toast('Falha ao autenticar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = regName.trim();
    const cleanPhone = regPhone.replace(/\D/g, '');
    const cleanRef = regRef.trim().toUpperCase();

    // Validations
    if (!validateName(trimmedName)) {
      toast('Nome inválido (mínimo de 2 caracteres).', 'error');
      return;
    }
    if (!validatePhone(cleanPhone)) {
      toast('Telefone inválido (padrão MZN: 82/83/84/85/86/87 + 7 dígitos).', 'error');
      return;
    }
    if (!validatePassword(regPass)) {
      toast('A senha deve conter no mínimo 6 caracteres.', 'error');
      return;
    }
    if (regPass !== regPass2) {
      toast('As senhas digitadas não coincidem.', 'error');
      return;
    }

    setLoading(true);
    try {
      const existingUser = PersistenceManager.getUserByPhone(cleanPhone);
      if (existingUser) {
        toast('Este número de telefone já está cadastrado no sistema.', 'error');
        setLoading(false);
        return;
      }

      const passwordHash = await hashPassword(regPass);
      const referralCode = generateRefCode();

      // Create new user blueprint
      const newUser: User = {
        id: generateUUID(),
        name: trimmedName,
        phone: cleanPhone,
        passwordHash,
        balance: 0,
        rechargeTotal: 0,
        vipLevel: 0,
        totalProfit: 0,
        referralCode,
        referredBy: cleanRef,
        firstDepositDone: false,
        team: [],
        transactions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBlocked: false,
        vipActivatedAt: null,
        lastWithdrawTs: null,
        lastCollectDate: null,
      };

      // Process referrals
      if (cleanRef) {
        const users = PersistenceManager.getAllUsers();
        const referrer = users.find((u) => u.referralCode === cleanRef);
        if (referrer) {
          referrer.team = referrer.team || [];
          referrer.team.push({
            phone: cleanPhone,
            name: trimmedName,
            joinedAt: new Date().toISOString(),
            firstDepositAt: null,
          });
          PersistenceManager.saveUser(referrer);
          
          PersistenceManager.writeAuditLog(null, newUser.id, 'user_referred_join', {
            referrerId: referrer.id,
            referrerPhone: referrer.phone,
          });
        }
      }

      // Save user
      PersistenceManager.saveUser(newUser);
      PersistenceManager.writeAuditLog(null, newUser.id, 'user_register', { phone: cleanPhone, referredBy: cleanRef });
      
      onLoginSuccess(newUser);
      toast('Sua conta foi criada com sucesso! Bem-vindo(a) à HTX.', 'success');
    } catch {
      toast('Erro inesperado ao criar a conta.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="bg-[#0d0d0d] rounded-sm w-full max-w-sm overflow-hidden shadow-2xl p-6 border border-white/10"
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full border border-[#c5a880]/30 bg-[#c5a880]/5 text-[#e2cca8] flex items-center justify-center mx-auto mb-2 text-sm font-serif italic text-gold">
            HTX
          </div>
          <h1 className="text-xl font-serif italic text-white tracking-widest">HTX Investimentos</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Plataforma Exclusiva de Rendimento</p>
        </div>

        {/* Tab selection */}
        <div className="grid grid-cols-2 bg-white/[0.01] border border-white/5 p-1 rounded-sm mb-6">
          <button 
            type="button"
            onClick={() => { setActiveTab('login'); }}
            className={`py-2 text-[10px] tracking-widest uppercase font-bold rounded-sm transition-all cursor-pointer ${
              activeTab === 'login' ? 'bg-[#c5a880] text-black shadow-sm' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <LogIn size={13} /> Entrar
            </span>
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('register'); }}
            className={`py-2 text-[10px] tracking-widest uppercase font-bold rounded-sm transition-all cursor-pointer ${
              activeTab === 'register' ? 'bg-[#c5a880] text-black shadow-sm' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <UserPlus size={13} /> Registar
            </span>
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Número de Telefone</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-mono border-r border-white/10 pr-2">+258</span>
                <input 
                  type="tel" 
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="84XXXXXXX"
                  maxLength={15}
                  required
                  className="w-full bg-[#050505] border border-white/10 rounded-sm pl-16 pr-4 py-3 text-xs tracking-wide focus:outline-none focus:border-[#c5a880] transition-colors text-white font-mono"
                />
                <Phone size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Senha</label>
              <div className="relative">
                <input 
                  type={showLoginPass ? 'text' : 'password'} 
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Sua senha de segurança"
                  required
                  className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white"
                />
                <button 
                  type="button" 
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white p-1 cursor-pointer select-none"
                >
                  {showLoginPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            <div className="bg-white/[0.01] border border-white/5 rounded-sm p-3.5 flex gap-2.5 items-start">
              <Shield className="text-[#e2cca8] mt-0.5 shrink-0" size={14} />
              <p className="text-[10px] text-white/40 leading-relaxed font-light">
                Servidores com criptografia local em Hash SHA-256. Seus dividendos e saldo da conta HTX estão 100% protegidos.
              </p>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] tracking-widest uppercase font-bold rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/35 border-t-black rounded-full animate-spin"></span>
              ) : (
                'Iniciar Sessão'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Nome Completo</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Seu nome oficial"
                  required
                  maxLength={50}
                  className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white"
                />
                <UserIcon size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Número de Telefone</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-mono border-r border-white/10 pr-2">+258</span>
                <input 
                  type="tel" 
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="84XXXXXXX"
                  maxLength={15}
                  required
                  className="w-full bg-[#050505] border border-white/10 rounded-sm pl-16 pr-4 py-3 text-xs tracking-wide focus:outline-none focus:border-[#c5a880] transition-colors text-white font-mono"
                />
                <Phone size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Senha</label>
              <div className="relative">
                <input 
                  type={showRegPass ? 'text' : 'password'} 
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  placeholder="Mínimo de 6 dígitos"
                  required
                  className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white"
                />
                <button 
                  type="button" 
                  onClick={() => setShowRegPass(!showRegPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white p-1 cursor-pointer select-none"
                >
                  {showRegPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Confirmar Senha</label>
              <div className="relative">
                <input 
                  type={showRegPass2 ? 'text' : 'password'} 
                  value={regPass2}
                  onChange={(e) => setRegPass2(e.target.value)}
                  placeholder="Repita a senha escrita"
                  required
                  className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] transition-colors text-white"
                />
                <button 
                  type="button" 
                  onClick={() => setShowRegPass2(!showRegPass2)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white p-1 cursor-pointer select-none"
                >
                  {showRegPass2 ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1 leading-none">Código de Convite (Opcional)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={regRef}
                  onChange={(e) => setRegRef(e.target.value.toUpperCase())}
                  placeholder="Ex: ABCXYZ"
                  maxLength={10}
                  className="w-full bg-[#050505] border border-white/10 rounded-sm px-4 py-3 text-xs focus:outline-none focus:border-[#c5a880] tracking-wider font-bold transition-colors text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-white/20"
                />
                <Gift size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            <div className="bg-white/[0.01] border border-white/5 rounded-sm p-3.5 flex gap-2.5 items-start">
              <Gift className="text-[#e2cca8] mt-0.5 shrink-0" size={14} />
              <p className="text-[10px] text-white/40 leading-relaxed font-light">
                Indicadores ativos recebem bônus imediato de <strong className="text-emerald-400">10%</strong> do montante integral de recarga inicial que cada afiliado cadastrar.
              </p>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-[#c5a880] hover:bg-[#a18863] text-black text-[10px] tracking-widest uppercase font-bold rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/35 border-t-black rounded-full animate-spin"></span>
              ) : (
                'Criar Conta HTX'
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
