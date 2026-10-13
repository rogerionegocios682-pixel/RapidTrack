import React, { useState } from 'react';
import {
  Bike,
  Building2,
  Mail,
  Lock,
  User,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { maskCnpj, maskPhone, validateCnpj } from '../../utils/formatters';

export const AuthView: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, registerCompany, resetPassword, loginAsMaster } = useAuth();

  type Mode = 'login' | 'register' | 'forgot';
  const [mode, setMode] = useState<Mode>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register company states
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [adminName, setAdminName] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);

  // Status and feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg('Informe seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    try {
      // Discreto: se for o e-mail master, realiza a autenticação master sem expor na UI
      if (email.trim().toLowerCase() === 'master@herculanogestor.com.br') {
        await loginAsMaster();
        return;
      }

      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('E-mail ou senha inválidos. Verifique suas credenciais.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('O login por e-mail/senha não está ativo no Firebase Authentication deste projeto. Utilize o acesso com Google ou usuário master.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMsg('Muitas tentativas sem sucesso. Tente novamente mais tarde.');
      } else {
        setErrorMsg(err.message || 'Erro ao realizar login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Falha na autenticação com Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!companyName || !tradeName || !email || !password || !adminName) {
      setErrorMsg('Preencha todos os campos obrigatórios da empresa.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (cnpj && !validateCnpj(cnpj)) {
      setErrorMsg('CNPJ informado é inválido. Verifique os números digitados.');
      return;
    }

    if (!acceptTerms) {
      setErrorMsg('É necessário aceitar os termos de uso do Delivery OS.');
      return;
    }

    setLoading(true);
    try {
      await registerCompany({
        companyName: companyName.trim(),
        tradeName: tradeName.trim(),
        cnpj: cnpj.trim(),
        adminName: adminName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
      });
      setSuccessMsg('Empresa e administrador cadastrados com sucesso!');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Este e-mail já está em uso por outro usuário.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('O cadastro por e-mail/senha não está habilitado no Firebase Authentication deste projeto. Utilize o login com Google.');
      } else {
        setErrorMsg(err.message || 'Erro ao criar conta empresarial.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email) {
      setErrorMsg('Informe o e-mail cadastrado para receber o link de recuperação.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccessMsg('Link de redefinição de senha enviado para seu e-mail! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Left hero banner (hidden on mobile) */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-[#0B192C] p-12 text-white lg:flex overflow-hidden">
        {/* Glow circles */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-orange-600/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-xl shadow-orange-500/30">
              <Bike className="h-6 w-6" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white">Delivery OS</span>
              <span className="block text-xs font-semibold text-orange-400 tracking-wider uppercase">
                Herculano Gestor
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-300 font-medium">Controle inteligente de entregas</p>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ecossistema Logístico Completo</span>
          </div>

          <h2 className="text-3xl font-extrabold leading-tight text-white lg:text-4xl">
            Acelere sua operação de delivery com precisão e controle.
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Plataforma SaaS para gestão operacional de motoboys, despacho em tempo real para múltiplos estabelecimentos (iFood, lojas parceiras), cálculo automático de tarifas por bairro, fechamento de turno auditável e relatórios em PDF.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xs">
              <p className="text-xl font-bold text-orange-400">100%</p>
              <p className="text-xs text-slate-300 mt-1">Isolamento Multiempresa com regras auditadas</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xs">
              <p className="text-xl font-bold text-emerald-400">Tempo Real</p>
              <p className="text-xs text-slate-300 mt-1">Ranking diário de motoboys e fechamento de turnos</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-6">
          <span>&copy; {new Date().getFullYear()} Delivery OS — Herculano Gestor</span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Segurança em conformidade com LGPD
          </span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center p-6 sm:p-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile branding header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900">Delivery OS</span>
              <span className="block text-[10px] font-bold text-orange-600 uppercase">
                Herculano Gestor
              </span>
            </div>
          </div>

          {/* Card container */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl">
            {/* Header tab/title */}
            <div className="mb-6">
              {mode === 'login' && (
                <>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">
                    Acessar Plataforma
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Informe suas credenciais para entrar no painel operacional.
                  </p>
                </>
              )}
              {mode === 'register' && (
                <>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">
                    Cadastrar Nova Empresa
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Crie a conta da sua operação logística e o primeiro administrador.
                  </p>
                </>
              )}
              {mode === 'forgot' && (
                <>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">
                    Recuperar Senha
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Enviaremos um link seguro para o seu e-mail cadastrado.
                  </p>
                </>
              )}
            </div>

            {/* Error / Success alerts */}
            {errorMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-tight">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span className="leading-tight">{successMsg}</span>
              </div>
            )}

            {/* Google Quick Sign-In */}
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Entrar com conta Google</span>
                </button>

                <div className="relative mb-5 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <span className="relative bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase">
                    ou com e-mail e senha
                  </span>
                </div>
              </>
            )}

            {/* Forms */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@empresa.com.br"
                      required
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Entrando...' : 'Entrar no Sistema'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Razão Social *
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="JC Logística LTDA"
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome Fantasia *
                    </label>
                    <input
                      type="text"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="JC Empreendimentos"
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CNPJ (opcional)
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                      placeholder="00.000.000/0001-00"
                      maxLength={18}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telefone da Empresa
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(maskPhone(e.target.value))}
                      placeholder="(81) 98765-4321"
                      maxLength={15}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Administrador *
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail do Administrador *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@suaempresa.com.br"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Senha de Acesso * (mínimo 6 dígitos)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 h-3.5 w-3.5 rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="terms" className="text-[11px] text-slate-600 leading-tight">
                    Concordo com os Termos de Uso e Política de Privacidade do Delivery OS (Herculano Gestor).
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Cadastrando...' : 'Finalizar Cadastro Empresarial'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail de Recuperação
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@empresa.com.br"
                      required
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                </button>
              </form>
            )}

            {/* Bottom navigation switches */}
            <div className="mt-6 border-t border-slate-100 pt-4 text-center">
              {mode === 'login' && (
                <p className="text-xs text-slate-600">
                  Ainda não possui empresa cadastrada?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-bold text-orange-600 hover:text-orange-700"
                  >
                    Cadastrar nova empresa
                  </button>
                </p>
              )}

              {mode !== 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  ← Voltar para o Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
