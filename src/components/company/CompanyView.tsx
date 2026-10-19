import React, { useState } from 'react';
import {
  Building2,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  Save,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { saveCompanySettings, createAuditLog } from '../../services/db';
import type { CompanySettings } from '../../types';
import {
  maskCnpj,
  maskPhone,
  maskCep,
  validateCnpj,
} from '../../utils/formatters';

export const CompanyView: React.FC = () => {
  const { companySettings, refreshCompanySettings, userProfile, isAdmin } = useAuth();

  const [legalName, setLegalName] = useState(companySettings?.legalName || '');
  const [tradeName, setTradeName] = useState(companySettings?.tradeName || '');
  const [cnpj, setCnpj] = useState(companySettings?.cnpj || '');
  const [phone, setPhone] = useState(companySettings?.phone || '');
  const [email, setEmail] = useState(companySettings?.email || '');
  const [cep, setCep] = useState(companySettings?.cep || '');
  const [address, setAddress] = useState(companySettings?.address || '');
  const [number, setNumber] = useState(companySettings?.number || '');
  const [complement, setComplement] = useState(companySettings?.complement || '');
  const [neighborhood, setNeighborhood] = useState(companySettings?.neighborhood || '');
  const [city, setCity] = useState(companySettings?.city || '');
  const [state, setState] = useState(companySettings?.state || 'PE');
  const [logoUrl, setLogoUrl] = useState(companySettings?.logoUrl || '');

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Handle Logo Upload (base64 image)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Selecione um arquivo de imagem válido (PNG, JPG, SVG).' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'A imagem deve ter no máximo 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!tradeName || !legalName) {
      setFeedback({ type: 'error', message: 'Informe a Razão Social e o Nome Fantasia da empresa.' });
      return;
    }

    if (cnpj && !validateCnpj(cnpj)) {
      setFeedback({ type: 'error', message: 'CNPJ inválido. Verifique os números digitados.' });
      return;
    }

    if (!companySettings?.tenantId || !userProfile) return;

    setLoading(true);
    try {
      const updated: CompanySettings = {
        tenantId: companySettings.tenantId,
        legalName: legalName.trim(),
        tradeName: tradeName.trim(),
        cnpj: cnpj.trim(),
        phone: phone.trim(),
        email: email.trim(),
        cep: cep.trim(),
        address: address.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        logoUrl: logoUrl || undefined,
        timezone: companySettings.timezone || 'America/Recife',
        shifts: companySettings.shifts || ['Geral', 'Manhã', 'Almoço / Tarde', 'Noite', 'Madrugada'],
        updatedAt: new Date().toISOString(),
      };

      await saveCompanySettings(updated);
      await refreshCompanySettings();

      await createAuditLog({
        tenantId: companySettings.tenantId,
        action: 'Dados da Empresa Administradora Atualizados',
        entity: 'company',
        entityId: companySettings.tenantId,
        details: `Empresa ${tradeName} atualizada por ${userProfile.name}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      setFeedback({ type: 'success', message: 'Dados da empresa e logomarca salvos com sucesso!' });
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar dados.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-orange-500" />
            Empresa Administradora da Operação
          </h2>
          <p className="text-xs text-slate-500">
            Configure os dados oficiais e a logomarca que aparecem no cabeçalho do sistema, nos relatórios em PDF e fechamentos.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl p-3 text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Info Card explaining separation */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 leading-relaxed">
        <p className="font-bold mb-1">Nota Arquitetural de Separação de Entidades:</p>
        <ul className="list-disc pl-4 space-y-0.5 text-blue-800 text-[11px]">
          <li>
            <strong>Empresa Administradora:</strong> A sua empresa de logística responsável pela frota e gestão (ex: JC Empreendimentos).
          </li>
          <li>
            <strong>Lojas de Origem:</strong> Estabelecimentos conveniados de onde saem os pedidos (ex: iFood Loja A, Hamburgueria Gourmet).
          </li>
          <li>
            <strong>Assinante SaaS:</strong> Titular da conta e dos dados cadastrais no Delivery OS.
          </li>
        </ul>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
        {/* Logo Upload Section */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Logomarca da Empresa (Aparece no Cabeçalho e nos Relatórios em PDF)
          </label>
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-xs overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-slate-300" />
              )}
            </div>

            <div className="space-y-2">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors">
                <Upload className="h-4 w-4 text-slate-600" />
                <span>Enviar Nova Imagem</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>

              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="block text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Remover logomarca
                </button>
              )}
              <p className="text-[10px] text-slate-400">PNG, JPG ou SVG recomendados. Até 2MB.</p>
            </div>
          </div>
        </div>

        {/* Legal and Trade Names */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Razão Social *
            </label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Ex: JC Empreendimentos e Logística LTDA"
              required
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
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
              placeholder="Ex: JC Empreendimentos"
              required
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* CNPJ, Phone and Email */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              CNPJ *
            </label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(maskCnpj(e.target.value))}
              placeholder="00.000.000/0001-00"
              maxLength={18}
              required
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:border-orange-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Telefone Operacional *
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(81) 3456-7890"
              maxLength={15}
              required
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              E-mail Comercial *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com.br"
              required
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Address Information */}
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Endereço da Sede Operacional
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                CEP
              </label>
              <input
                type="text"
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                placeholder="00000-000"
                maxLength={9}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Logradouro / Avenida
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Engenheiro Domingos Ferreira"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Número
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="1420"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Complemento
              </label>
              <input
                type="text"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Sala 402"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Boa Viagem"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Recife"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estado (UF)
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="PE"
                maxLength={2}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        {isAdmin && (
          <div className="flex items-center justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 disabled:opacity-50 transition-all"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Salvando...' : 'Salvar Dados da Empresa'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
