import React, { useState } from 'react';
import {
  LayoutDashboard,
  Send,
  Users,
  Building2,
  FileText,
  Settings,
  ChevronRight,
  ChevronDown,
  Bike,
  Store,
  MapPin,
  TrendingUp,
  UserCheck,
  CalendarCheck,
  Award,
  History,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type ActivePage =
  | 'dashboard'
  | 'dispatch'
  | 'cadastros-motoboys'
  | 'cadastros-lojas'
  | 'cadastros-tarifas'
  | 'relatorios-lojas'
  | 'relatorios-motoboys'
  | 'relatorios-mensal'
  | 'relatorios-ranking'
  | 'relatorios-fechamentos'
  | 'empresa'
  | 'usuarios'
  | 'configuracoes';

interface SidebarProps {
  activePage: ActivePage;
  onSelectPage: (page: ActivePage) => void;
  isOpen: boolean;
  onClose: () => void;
  pendingOrdersCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  isOpen,
  onClose,
  pendingOrdersCount,
}) => {
  const { isAdmin, isOperator } = useAuth();
  const [cadastrosOpen, setCadastrosOpen] = useState(
    activePage.startsWith('cadastros-')
  );
  const [relatoriosOpen, setRelatoriosOpen] = useState(
    activePage.startsWith('relatorios-')
  );

  const handleNavClick = (page: ActivePage) => {
    onSelectPage(page);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col bg-[#0B192C] text-slate-300 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-800 shadow-2xl lg:shadow-none`}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white font-black shadow-lg shadow-orange-500/20">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Delivery OS
              </span>
              <span className="block text-[10px] font-medium tracking-wider text-orange-400 uppercase">
                Herculano Gestor
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin">
          {/* Dashboard (Apenas Administrador) */}
          {isAdmin && (
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                activePage === 'dashboard'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
          )}

          {/* Despachar Pedidos (Operational Core) */}
          <button
            onClick={() => handleNavClick('dispatch')}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
              activePage === 'dispatch'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Send className="h-4 w-4 text-orange-400" />
              <span>Despachar Pedidos</span>
            </div>
            {pendingOrdersCount > 0 && (
              <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          {/* Cadastros Dropdown */}
          <div>
            <button
              onClick={() => setCadastrosOpen(!cadastrosOpen)}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                activePage.startsWith('cadastros-')
                  ? 'bg-slate-800/90 text-white'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Store className="h-4 w-4 text-slate-400" />
                <span>Cadastros</span>
              </div>
              {cadastrosOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {cadastrosOpen && (
              <div className="mt-1 ml-4 space-y-1 border-l-2 border-slate-700/60 pl-3">
                <button
                  onClick={() => handleNavClick('cadastros-motoboys')}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                    activePage === 'cadastros-motoboys'
                      ? 'bg-orange-500/20 text-orange-300 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Bike className="h-3.5 w-3.5" />
                  <span>Motoboys</span>
                </button>

                <button
                  onClick={() => handleNavClick('cadastros-lojas')}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                    activePage === 'cadastros-lojas'
                      ? 'bg-orange-500/20 text-orange-300 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>Empresas de Entrega</span>
                </button>

                <button
                  onClick={() => handleNavClick('cadastros-tarifas')}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                    activePage === 'cadastros-tarifas'
                      ? 'bg-orange-500/20 text-orange-300 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Bairros e Tarifas</span>
                </button>
              </div>
            )}
          </div>

          {/* Relatórios Dropdown (Apenas Administrador) */}
          {isAdmin && (
            <div>
              <button
                onClick={() => setRelatoriosOpen(!relatoriosOpen)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                  activePage.startsWith('relatorios-')
                    ? 'bg-slate-800/90 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span>Relatórios</span>
                </div>
                {relatoriosOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {relatoriosOpen && (
                <div className="mt-1 ml-4 space-y-1 border-l-2 border-slate-700/60 pl-3">
                  <button
                    onClick={() => handleNavClick('relatorios-lojas')}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      activePage === 'relatorios-lojas'
                        ? 'bg-orange-500/20 text-orange-300 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <Store className="h-3.5 w-3.5" />
                    <span>Por Empresa</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('relatorios-motoboys')}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      activePage === 'relatorios-motoboys'
                        ? 'bg-orange-500/20 text-orange-300 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Por Motoboy</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('relatorios-mensal')}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      activePage === 'relatorios-mensal'
                        ? 'bg-orange-500/20 text-orange-300 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    <span>Consolidado Mensal</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('relatorios-ranking')}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      activePage === 'relatorios-ranking'
                        ? 'bg-orange-500/20 text-orange-300 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>Ranking de Motoboys</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('relatorios-fechamentos')}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      activePage === 'relatorios-fechamentos'
                        ? 'bg-orange-500/20 text-orange-300 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Fechamento de Turno</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Empresa Administradora */}
          <button
            onClick={() => handleNavClick('empresa')}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
              activePage === 'empresa'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Empresa Administradora</span>
          </button>

          {/* Usuários e Permissões (Apenas Administrador) */}
          {isAdmin && (
            <button
              onClick={() => handleNavClick('usuarios')}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                activePage === 'usuarios'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Usuários e Permissões</span>
            </button>
          )}

          {/* Configurações & Auditoria */}
          <button
            onClick={() => handleNavClick('configuracoes')}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
              activePage === 'configuracoes'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Configurações & Auditoria</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800/80 p-4">
          <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
            <p className="text-[11px] font-bold text-white">Controle inteligente de entregas</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Módulo SaaS Herculano Gestor</p>
            <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
              <span>Versão 1.0 Pro</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
