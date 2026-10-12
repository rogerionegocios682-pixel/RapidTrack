/**
 * AuthContext for Delivery OS
 * Multi-tenant authentication, session management, and role checking
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  getUserProfile,
  saveUserProfile,
  getTenant,
  createTenant,
  getCompanySettings,
  saveCompanySettings,
  seedDemoDataIfEmpty,
  createAuditLog,
} from '../services/db';
import type { Tenant, UserProfile, CompanySettings, UserRole } from '../types';

interface RegisterCompanyData {
  companyName: string;
  tradeName: string;
  cnpj: string;
  adminName: string;
  email: string;
  password: string;
  phone: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  tenant: Tenant | null;
  companySettings: CompanySettings | null;
  loading: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerCompany: (data: RegisterCompanyData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCompanySettings: () => Promise<void>;
  seedDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // Fetch user profile
          let profile = await getUserProfile(user.uid);

          if (!profile) {
            // First time or Google Login without profile: create default tenant & profile
            const tenantId = `tenant_${user.uid.slice(0, 10)}`;
            const defaultTradeName = user.displayName || 'JC Logística & Entregas';

            const newTenant: Tenant = {
              id: tenantId,
              name: defaultTradeName,
              tradeName: defaultTradeName,
              email: user.email || '',
              maxStores: 10,
              createdAt: new Date().toISOString(),
            };
            await createTenant(newTenant);

            profile = {
              uid: user.uid,
              tenantId,
              email: user.email || '',
              name: user.displayName || 'Administrador',
              role: 'admin',
              active: true,
              createdAt: new Date().toISOString(),
            };
            await saveUserProfile(profile);

            // Create initial company settings
            const initialSettings: CompanySettings = {
              tenantId,
              legalName: `${defaultTradeName} LTDA`,
              tradeName: defaultTradeName,
              cnpj: '18.924.512/0001-44',
              phone: '(81) 3456-7890',
              email: user.email || 'contato@herculanogestor.com.br',
              cep: '51020-010',
              address: 'Avenida Engenheiro Domingos Ferreira',
              number: '1420',
              complement: 'Sala 402',
              neighborhood: 'Boa Viagem',
              city: 'Recife',
              state: 'PE',
              timezone: 'America/Recife',
              shifts: ['Geral', 'Manhã', 'Almoço / Tarde', 'Noite', 'Madrugada'],
              updatedAt: new Date().toISOString(),
            };
            await saveCompanySettings(initialSettings);

            // Seed demo data for rich initial experience
            await seedDemoDataIfEmpty(tenantId, defaultTradeName);
          }

          setUserProfile(profile);

          // Fetch Tenant info
          if (profile?.tenantId) {
            const tenantData = await getTenant(profile.tenantId);
            setTenant(tenantData);

            let settings = await getCompanySettings(profile.tenantId);
            if (!settings) {
              settings = {
                tenantId: profile.tenantId,
                legalName: tenantData?.name || 'Operação de Entregas',
                tradeName: tenantData?.tradeName || 'Delivery OS Gestor',
                cnpj: '18.924.512/0001-44',
                phone: '(81) 3456-7890',
                email: profile.email,
                cep: '51020-010',
                address: 'Avenida Engenheiro Domingos Ferreira',
                number: '1420',
                complement: 'Sala 402',
                neighborhood: 'Boa Viagem',
                city: 'Recife',
                state: 'PE',
                timezone: 'America/Recife',
                shifts: ['Geral', 'Manhã', 'Almoço / Tarde', 'Noite', 'Madrugada'],
                updatedAt: new Date().toISOString(),
              };
              await saveCompanySettings(settings);
            }
            setCompanySettings(settings);
          }
        } catch (err) {
          console.error('Error loading user session data:', err);
        }
      } else {
        setUserProfile(null);
        setTenant(null);
        setCompanySettings(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshCompanySettings = async () => {
    if (userProfile?.tenantId) {
      const s = await getCompanySettings(userProfile.tenantId);
      if (s) setCompanySettings(s);
    }
  };

  const seedDemo = async () => {
    if (userProfile?.tenantId && companySettings) {
      await seedDemoDataIfEmpty(userProfile.tenantId, companySettings.tradeName);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const registerCompany = async (data: RegisterCompanyData) => {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;
    const tenantId = `tenant_${user.uid.slice(0, 10)}`;

    const newTenant: Tenant = {
      id: tenantId,
      name: data.companyName,
      tradeName: data.tradeName,
      cnpj: data.cnpj,
      email: data.email,
      phone: data.phone,
      maxStores: 10,
      createdAt: new Date().toISOString(),
    };
    await createTenant(newTenant);

    const newProfile: UserProfile = {
      uid: user.uid,
      tenantId,
      email: data.email,
      name: data.adminName,
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString(),
    };
    await saveUserProfile(newProfile);

    const initialSettings: CompanySettings = {
      tenantId,
      legalName: data.companyName,
      tradeName: data.tradeName,
      cnpj: data.cnpj,
      phone: data.phone,
      email: data.email,
      cep: '51020-010',
      address: 'Avenida Engenheiro Domingos Ferreira',
      number: '1420',
      complement: '',
      neighborhood: 'Boa Viagem',
      city: 'Recife',
      state: 'PE',
      timezone: 'America/Recife',
      shifts: ['Geral', 'Manhã', 'Almoço / Tarde', 'Noite', 'Madrugada'],
      updatedAt: new Date().toISOString(),
    };
    await saveCompanySettings(initialSettings);

    // Seed realistic operational data for testing
    await seedDemoDataIfEmpty(tenantId, data.tradeName);

    await createAuditLog({
      tenantId,
      action: 'Empresa cadastrada no SaaS',
      entity: 'company',
      entityId: tenantId,
      details: `Empresa ${data.tradeName} criada por ${data.adminName}`,
      userId: user.uid,
      userEmail: data.email,
    });
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const role: UserRole = userProfile?.role || 'viewer';
  const isAdmin = role === 'admin';
  const isOperator = role === 'admin' || role === 'operator';
  const isViewer = role === 'viewer';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        tenant,
        companySettings,
        loading,
        isAdmin,
        isOperator,
        isViewer,
        loginWithEmail,
        loginWithGoogle,
        registerCompany,
        resetPassword,
        logout,
        refreshCompanySettings,
        seedDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
