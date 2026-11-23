import React, { useState, useEffect } from 'react';
import { UserProfile, Transaction, ToastMessage } from '../types';
import { updateUserProfileData } from '../services/firebase';
import {
  Save,
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

interface ProfileProps {
  user: UserProfile;
  transactions: Transaction[];
  onUpdateUser: (user: UserProfile) => void;
  onShowToast: (msg: string, type?: ToastMessage['type']) => void;
}

const getAutoAvatarUrl = (name: string | null | undefined) => {
  const safeName = encodeURIComponent((name || 'Usuário').trim() || 'Usuário');
  return `https://ui-avatars.com/api/?name=${safeName}&background=2F6BFF&color=fff&size=256`;
};

const Profile: React.FC<ProfileProps> = ({ user, transactions, onUpdateUser, onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    displayName: user.displayName || '',
    bio: user.bio || '',
    phoneNumber: user.phoneNumber || '',
    jobTitle: user.jobTitle || '',
    website: user.website || '',
    photoURL: user.photoURL || '',
  });

  useEffect(() => {
    setFormData({
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      bio: user.bio || '',
      phoneNumber: user.phoneNumber || '',
      jobTitle: user.jobTitle || '',
      website: user.website || '',
    });
    setImageError(false);
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'photoURL') setImageError(false);
    setErrorMsg(null);
  };

  const handleResetAvatar = () => {
    setFormData((prev) => ({ ...prev, photoURL: '' }));
    setImageError(false);
    onShowToast('Avatar automático selecionado. Clique em Salvar Alterações.', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const saved = await updateUserProfileData(user.uid, formData);
      onUpdateUser({ ...user, ...saved });
      onShowToast('Perfil atualizado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      let msg = error?.message || 'Erro desconhecido';
      if (msg.includes('PERMISSION_DENIED') || msg.startsWith('{')) {
        msg = 'Permissão negada ou formato inválido. Verifique se URLs começam com https://.';
      }
      setErrorMsg(`Erro ao salvar: ${msg}`);
      onShowToast('Erro ao salvar perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : 'Membro Ativo';
  const totalTx = transactions.length;
  const previewSrc =
    formData.photoURL && !imageError
      ? formData.photoURL
      : getAutoAvatarUrl(formData.displayName || user.displayName);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* PROFILE HERO BANNER */}
      <div className="oneui-card relative overflow-hidden p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
          <div className="relative shrink-0">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full shadow-lg overflow-hidden relative"
              style={{
                backgroundColor: 'var(--app-surface-2)',
                border: '2px solid var(--app-border-strong)',
              }}
            >
              <img
                src={previewSrc}
                alt="Avatar"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            </div>
            {user.emailVerified && (
              <div
                className="absolute bottom-1 right-1 bg-[#30D158] text-white rounded-full p-1"
                style={{ border: '2px solid var(--app-surface)' }}
              >
                <CheckCircle2 size={14} strokeWidth={3} />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1.5">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="text-2xl md:text-3xl font-extrabold oneui-text tracking-tight">
                {formData.displayName || 'Usuário Capitalyx'}
              </h2>
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#30D158] self-center md:self-auto">
                  <ShieldCheck size={14} />
                  ID Verificado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#FF9F0A] self-center md:self-auto">
                  Não verificado
                </span>
              )}
            </div>
            <p className="text-[15px] font-semibold" style={{ color: 'var(--app-accent)' }}>
              {formData.jobTitle || 'Membro Capitalyx'}
            </p>
            <p className="text-[13px] oneui-text-muted">
              {user.email || 'Conta de Acesso'} · Desde {joinDate}
            </p>

            <div className="flex items-center justify-center md:justify-start gap-3 pt-3">
              <div className="oneui-surface-2 px-4 py-2 text-center">
                <span className="text-[16px] font-bold oneui-text block tabular-nums">{totalTx}</span>
                <span className="text-[10px] oneui-text-muted uppercase tracking-wider">Transações</span>
              </div>
              <div className="oneui-surface-2 px-4 py-2 text-center">
                <span className="text-[16px] font-bold text-[#30D158] block">Ativa</span>
                <span className="text-[10px] oneui-text-muted uppercase tracking-wider">Conta</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div
          className="oneui-card bg-[#FF453A]/10 text-[#FF453A] p-4 flex items-center gap-2.5 text-[14px]"
          style={{ borderColor: 'rgba(255,69,58,0.35)' }}
        >
          <AlertTriangle size={18} className="shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* EDIT PROFILE FORM */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <section>
          <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
            Foto de Perfil (URL ou Avatar Automático)
          </p>
          <div className="oneui-card p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 oneui-text-secondary shrink-0 min-w-[125px]">
                <ImageIcon size={17} style={{ color: 'var(--app-accent)' }} />
                <label className="text-[14px] font-medium">URL da Foto</label>
              </div>
              <input
                type="url"
                name="photoURL"
                maxLength={1000}
                value={formData.photoURL || ''}
                onChange={handleChange}
                placeholder="https://exemplo.com/sua-foto.jpg (vazio = automático)"
                className="flex-1 oneui-surface-2 rounded-[14px] px-3.5 py-2.5 text-[14px] oneui-text placeholder:opacity-45 focus:outline-none"
              />
              {formData.photoURL && (
                <button
                  type="button"
                  onClick={handleResetAvatar}
                  className="oneui-surface-2 oneui-hover oneui-text px-3.5 py-2.5 rounded-[14px] text-[13px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <RotateCcw size={14} />
                  <span>Avatar Padrão</span>
                </button>
              )}
            </div>
            {imageError && formData.photoURL && (
              <p className="text-[12px] text-[#FF9F0A]">
                Não foi possível carregar a imagem dessa URL. O avatar automático será exibido até você corrigir o link.
              </p>
            )}
          </div>
        </section>

        <section>
          <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
            Informações Pessoais
          </p>

          <div className="oneui-card oneui-divider overflow-hidden">
            <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-[14px] font-medium oneui-text-secondary min-w-[130px]">Nome Completo</label>
              <input
                type="text"
                name="displayName"
                maxLength={100}
                required
                value={formData.displayName || ''}
                onChange={handleChange}
                placeholder="Seu nome"
                className="w-full sm:text-right bg-transparent text-[15px] oneui-text placeholder:opacity-40 focus:outline-none"
              />
            </div>

            <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-[14px] font-medium oneui-text-secondary min-w-[130px]">
                Profissão / Cargo
              </label>
              <input
                type="text"
                name="jobTitle"
                maxLength={100}
                value={formData.jobTitle || ''}
                onChange={handleChange}
                placeholder="Ex: Engenheiro, Empreendedor"
                className="w-full sm:text-right bg-transparent text-[15px] oneui-text placeholder:opacity-40 focus:outline-none"
              />
            </div>

            <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-[14px] font-medium oneui-text-secondary min-w-[130px]">Telefone</label>
              <input
                type="tel"
                name="phoneNumber"
                maxLength={30}
                value={formData.phoneNumber || ''}
                onChange={handleChange}
                placeholder="+55 (11) 99999-9999"
                className="w-full sm:text-right bg-transparent text-[15px] oneui-text placeholder:opacity-40 focus:outline-none"
              />
            </div>

            <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-[14px] font-medium oneui-text-secondary min-w-[130px]">Website</label>
              <input
                type="url"
                name="website"
                maxLength={300}
                value={formData.website || ''}
                onChange={handleChange}
                placeholder="https://seusite.com"
                className="w-full sm:text-right bg-transparent text-[15px] placeholder:opacity-40 focus:outline-none"
                style={{ color: 'var(--app-accent)' }}
              />
            </div>

            <div className="p-4 sm:px-5 flex flex-col gap-2">
              <label className="text-[14px] font-medium oneui-text-secondary">Biografia / Objetivos</label>
              <textarea
                name="bio"
                maxLength={500}
                value={formData.bio || ''}
                onChange={handleChange}
                rows={3}
                placeholder="Conte um pouco sobre suas metas financeiras..."
                className="w-full oneui-surface-2 rounded-[16px] p-3.5 text-[14px] oneui-text placeholder:opacity-40 focus:outline-none resize-none"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto oneui-accent-btn font-semibold py-3.5 px-8 rounded-[18px] shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all text-[15px] disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            <span>Salvar Alterações</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
