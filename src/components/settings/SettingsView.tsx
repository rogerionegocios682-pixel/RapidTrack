import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  ShieldAlert,
  Search,
  Filter,
  Clock,
  Save,
  CheckCircle,
  Database,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listenAuditLogs,
  saveCompanySettings,
  createAuditLog,
} from '../../services/db';
import type { AuditLog } from '../../types';
import { formatDateTime } from '../../utils/formatters';

export const SettingsView: React.FC = () => {
  const { companySettings, refreshCompanySettings, userProfile, isAdmin, seedDemo } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntity, setFilterEntity] = useState<string>('all');

  // Shifts management
  const [shiftsInput, setShiftsInput] = useState(
    companySettings?.shifts?.join(', ') || 'Geral, Manhã, Almoço / Tarde, Noite, Madrugada'
  );
  const [timezone, setTimezone] = useState(companySettings?.timezone || 'America/Recife');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.tenantId) return;
    const unsub = listenAuditLogs(userProfile.tenantId, (loaded) => {
      setAuditLogs(loaded);
    });
    return () => unsub();
  }, [userProfile?.tenantId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companySettings || !userProfile) return;

    setSaving(true);
    try {
      const parsedShifts = shiftsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await saveCompanySettings({
        ...companySettings,
        shifts: parsedShifts,
        timezone,
      });

      await refreshCompanySettings();

      await createAuditLog({
        tenantId: companySettings.tenantId,
        action: 'Configurações do sistema alteradas',
        entity: 'company',
        entityId: companySettings.tenantId,
        details: `Turnos e fuso horário atualizados por ${userProfile.name}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      setFeedback('Configurações salvas com sucesso!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (filterEntity !== 'all' && log.entity !== filterEntity) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.userEmail.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, filterEntity, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-orange-500" />
          Configurações Operacionais & Trilha de Auditoria
        </h2>
        <p className="text-xs text-slate-500">
          Turnos de trabalho, fuso horário oficial e histórico imutável de eventos auditados do sistema.
        </p>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Operational Settings Form */}
      {isAdmin && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-900">Parâmetros Operacionais</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Turnos de Trabalho Disponíveis (Separados por vírgula)
              </label>
              <input
                type="text"
                value={shiftsInput}
                onChange={(e) => setShiftsInput(e.target.value)}
                placeholder="Ex: Geral, Manhã, Almoço / Tarde, Noite, Madrugada"
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Os turnos configurados aqui aparecem no cadastro de corridas e no fechamento.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fuso Horário Operacional
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
              >
                <option value="America/Recife">America/Recife (UTC-3) — Padrão</option>
                <option value="America/Sao_Paulo">America/Sao_Paulo (UTC-3)</option>
                <option value="America/Fortaleza">America/Fortaleza (UTC-3)</option>
                <option value="America/Manaus">America/Manaus (UTC-4)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={async () => {
                await seedDemo();
                alert('Dados operacionais de demonstração inseridos com sucesso!');
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-orange-600"
            >
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span>Inserir Dados de Exemplo para Testes</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Parâmetros'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Trilha de Auditoria (Audit Log Table) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              Trilha de Auditoria (Audit Trail)
            </h3>
            <p className="text-xs text-slate-500">
              Registro cronológico de operações críticas: criação, cancelamento, alteração manual de tarifas e fechamentos.
            </p>
          </div>

          {/* Filter Audit Logs */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no log..."
                className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
            >
              <option value="all">Todas as Entidades</option>
              <option value="order">Corridas / Pedidos</option>
              <option value="rate">Tarifas</option>
              <option value="shift">Fechamentos</option>
              <option value="motoboy">Motoboys</option>
              <option value="store">Empresas</option>
              <option value="user">Usuários</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Ação Realizada</th>
                <th className="py-3 px-4">Entidade</th>
                <th className="py-3 px-4">Detalhes do Evento</th>
                <th className="py-3 px-4">Operador Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{log.action}</td>
                    <td className="py-2.5 px-4">
                      <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 border uppercase">
                        {log.entity}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                      {log.userEmail}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
