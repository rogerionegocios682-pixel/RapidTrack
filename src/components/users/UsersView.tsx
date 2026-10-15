import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  User,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listenTenantUsers, saveUserProfile, createAuditLog } from '../../services/db';
import type { UserProfile, UserRole } from '../../types';
import { formatDate } from '../../utils/formatters';

export const UsersView: React.FC = () => {
  const { userProfile, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Invite/add user form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.tenantId) return;
    const unsub = listenTenantUsers(userProfile.tenantId, (loaded) => {
      setUsers(loaded);
    });
    return () => unsub();
  }, [userProfile?.tenantId]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !userProfile?.tenantId) return;

    setLoading(true);
    try {
      const generatedUid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newProfile: UserProfile = {
        uid: generatedUid,
        tenantId: userProfile.tenantId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        active: true,
        createdAt: new Date().toISOString(),
      };

      await saveUserProfile(newProfile);

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: 'Usuário operador cadastrado',
        entity: 'user',
        entityId: generatedUid,
        details: `Usuário ${name} cadastrado com perfil ${role.toUpperCase()}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      setIsInviteModalOpen(false);
      setName('');
      setEmail('');
      setFeedback(`Usuário ${name} cadastrado com sucesso!`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert('Erro ao cadastrar usuário: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserRole = async (u: UserProfile, newRole: UserRole) => {
    if (!isAdmin || !userProfile) return;
    try {
      await saveUserProfile({
        ...u,
        role: newRole,
      });

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: 'Perfil de usuário alterado',
        entity: 'user',
        entityId: u.uid,
        details: `Perfil de ${u.name} alterado para ${newRole.toUpperCase()} por ${userProfile.name}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });
    } catch (err: any) {
      alert('Erro ao alterar perfil: ' + err.message);
    }
  };

  const handleToggleUserActive = async (u: UserProfile) => {
    if (!isAdmin || !userProfile) return;
    try {
      await saveUserProfile({
        ...u,
        active: !u.active,
      });

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: u.active ? 'Usuário inativado' : 'Usuário ativado',
        entity: 'user',
        entityId: u.uid,
        details: `Status de ${u.name} alterado para ${!u.active ? 'ATIVO' : 'INATIVO'}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900 shadow-xs">
        <ShieldCheck className="mx-auto h-10 w-10 text-amber-600 mb-2" />
        <h3 className="text-lg font-black">Acesso Restrito ao Administrador</h3>
        <p className="mt-2 text-xs text-amber-700 max-w-md mx-auto">
          No controle de usuários, apenas o <strong>Administrador</strong> tem permissão total.
          Operadores e usuários de Consulta não possuem acesso ao gerenciamento de usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-orange-500" />
            Controle de Usuários e Permissões (RBAC)
          </h2>
          <p className="text-xs text-slate-500">
            Apenas Administradores possuem permissão total. Operadores e Consulta não acessam Dashboard, Relatórios e Usuários.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all self-start sm:self-auto"
          >
            <UserPlus className="h-4 w-4" />
            <span>Adicionar Operador</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-black text-orange-800 uppercase tracking-wide">
            ADMINISTRADOR (PERMISSÃO TOTAL)
          </span>
          <p className="mt-2 text-xs text-slate-700 leading-relaxed font-medium">
            Permissão irrestrita e total: Acesso exclusivo ao <strong>Dashboard</strong> executivo, <strong>Relatórios</strong> financeiros/operacionais, <strong>Usuários</strong> e Permissões, além de Despacho de Pedidos, Cadastros e Configurações.
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-black text-blue-800 uppercase tracking-wide">
            OPERADOR
          </span>
          <p className="mt-2 text-xs text-slate-700 leading-relaxed font-medium">
            Acesso operacional para Despacho de Pedidos, confirmação de entregas e Cadastros. 
            <span className="block mt-1 font-bold text-blue-900">
              ⛔ Sem acesso ao Dashboard, Relatórios e Usuários.
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-100/60 p-4">
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-700 uppercase tracking-wide">
            CONSULTA
          </span>
          <p className="mt-2 text-xs text-slate-700 leading-relaxed font-medium">
            Visualização restrita apenas de Despacho e Cadastros operacionais.
            <span className="block mt-1 font-bold text-slate-900">
              ⛔ Sem acesso ao Dashboard, Relatórios e Usuários.
            </span>
          </p>
        </div>
      </div>

      {/* Users table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-3 px-4">Usuário</th>
              <th className="py-3 px-4">E-mail</th>
              <th className="py-3 px-4">Perfil de Acesso</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Criado em</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {users.map((u) => {
              const isCurrent = u.uid === userProfile?.uid;

              return (
                <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                        {u.name.charAt(0)}
                      </div>
                      <span>{u.name}</span>
                      {isCurrent && (
                        <span className="rounded-sm bg-slate-100 px-1 text-[9px] font-bold text-slate-500 border">
                          Você
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{u.email}</td>
                  <td className="py-3 px-4">
                    {isAdmin && !isCurrent ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleToggleUserRole(u, e.target.value as UserRole)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:outline-hidden"
                      >
                        <option value="admin">Administrador</option>
                        <option value="operator">Operador</option>
                        <option value="viewer">Consulta</option>
                      </select>
                    ) : (
                      <span className="inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold border uppercase">
                        {u.role === 'admin' ? 'Administrador' : u.role === 'operator' ? 'Operador' : 'Consulta'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <CheckCircle className="h-3 w-3" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                        <XCircle className="h-3 w-3" /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{formatDate(u.createdAt)}</td>
                  <td className="py-3 px-4 text-right">
                    {isAdmin && !isCurrent && (
                      <button
                        onClick={() => handleToggleUserActive(u)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                          u.active
                            ? 'text-red-600 border-red-200 hover:bg-red-50'
                            : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        {u.active ? 'Inativar' : 'Reativar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal to add operator */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-orange-500" />
              Adicionar Novo Operador
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Cadastre o operador da sua equipe com as permissões apropriadas.
            </p>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do operador"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail do Operador *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@suaempresa.com.br"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Perfil de Acesso *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
                >
                  <option value="operator">Operador (Despacho e Cadastros - Sem Dashboard, Relatórios e Usuários)</option>
                  <option value="viewer">Consulta (Leitura Operacional - Sem Dashboard, Relatórios e Usuários)</option>
                  <option value="admin">Administrador (Permissão Total ao Sistema)</option>
                </select>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Cadastrando...' : 'Cadastrar Operador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
