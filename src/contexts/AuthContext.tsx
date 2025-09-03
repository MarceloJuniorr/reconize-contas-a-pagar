import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isPagador: boolean;
  isOperador: boolean;
  isLeitor: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Fetch profile with roles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      const userRoles = rolesData?.map(r => r.role) || [];
      
      setProfile({
        id: profileData.id,
        full_name: profileData.full_name,
        email: profileData.email,
        roles: userRoles
      });

      // Se chegou até aqui, o usuário já passou pela verificação no login
      // Não fazer logout automático aqui
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: error.message,
        });
        return { error };
      }

      // Verificar se o usuário tem roles ativos após login bem-sucedido
      if (data.user) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id);

        if (rolesError) {
          console.error('Erro ao verificar roles:', rolesError);
          await supabase.auth.signOut();
          toast({
            variant: "destructive",
            title: "Erro no login",
            description: "Erro interno do sistema. Tente novamente.",
          });
          return { error: rolesError };
        }

        const userRoles = rolesData?.map(r => r.role) || [];
        
        // Se o usuário não tem roles, considerar inativo
        if (userRoles.length === 0) {
          await supabase.auth.signOut();
          const inactiveError = new Error("Usuário inativo. Sua conta ainda não foi ativada por um administrador.");
          toast({
            variant: "destructive",
            title: "Acesso negado",
            description: "Usuário inativo. Sua conta ainda não foi ativada por um administrador.",
          });
          return { error: inactiveError };
        }
      }

      return { error: null };
    } catch (error) {
      const errorObj = error as Error;
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: errorObj.message,
      });
      return { error: errorObj };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no cadastro",
          description: error.message,
        });
        return { error };
      }

      toast({
        title: "Cadastro realizado",
        description: "Verifique seu email para confirmar sua conta.",
      });

      return { error: null };
    } catch (error) {
      const errorObj = error as Error;
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: errorObj.message,
      });
      return { error: errorObj };
    }
  };

  const signOut = async () => {
    try {
      // Limpar dados locais primeiro
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Fazer logout do Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
      }
      
      toast({
        title: "Logout realizado", 
        description: "Você foi desconectado com sucesso.",
      });
      
      // Forçar redirecionamento para login
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
      // Mesmo em caso de erro, limpar dados locais e redirecionar
      setUser(null);
      setSession(null);
      setProfile(null);
      window.location.href = '/auth';
    }
  };

  const isAdmin = profile?.roles.includes('admin') || false;
  const isPagador = profile?.roles.includes('pagador') || false;
  const isOperador = profile?.roles.includes('operador') || false;
  const isLeitor = profile?.roles.includes('leitor') || false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isPagador,
        isOperador,
        isLeitor,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}