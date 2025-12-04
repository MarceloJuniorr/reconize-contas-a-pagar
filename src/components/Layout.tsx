import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Building2, MapPin, LogOut, Users, Menu, Store, Package, Warehouse, UserCheck, ShoppingCart, CreditCard, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import reconizeLogo from '@/assets/reconize-gestao-inteligente1.jpg';
import { supabase } from '@/integrations/supabase/client';

const Layout = () => {
  const { signOut, hasRole, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasStoreAccess, setHasStoreAccess] = useState(false);

  useEffect(() => {
    checkStoreAccess();
  }, [user]);

  const checkStoreAccess = async () => {
    if (!user) {
      setHasStoreAccess(false);
      return;
    }

    // Admin e operador sempre têm acesso
    if (hasRole('admin') || hasRole('operador')) {
      setHasStoreAccess(true);
      return;
    }

    // Verificar se usuário tem lojas vinculadas
    const { data } = await (supabase as any)
      .from('user_stores')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    setHasStoreAccess(data && data.length > 0);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Contas a Pagar', href: '/accounts', icon: FileText },
    { name: 'Fornecedores', href: '/suppliers', icon: Building2 },
    { name: 'Centros de Custo', href: '/cost-centers', icon: MapPin },
  ];

  // Menus de Lojas, Produtos e Estoque (apenas para quem tem acesso)
  if (hasRole('admin') || hasRole('operador')) {
    navigation.push({ name: 'Lojas', href: '/stores', icon: Store });
  }

  if (hasStoreAccess) {
    navigation.push({ name: 'PDV', href: '/pdv', icon: ShoppingCart });
    navigation.push({ name: 'Vendas', href: '/sales', icon: ShoppingBag });
    navigation.push({ name: 'Produtos', href: '/products', icon: Package });
    navigation.push({ name: 'Estoque', href: '/stock', icon: Warehouse });
    navigation.push({ name: 'Clientes', href: '/customers', icon: UserCheck });
  }

  if (hasRole('admin') || hasRole('operador')) {
    navigation.push({ name: 'Métodos Pagamento', href: '/payment-methods', icon: CreditCard });
  }

  if (hasRole('admin')) {
    navigation.push({
      name: 'Usuários',
      href: '/users',
      icon: Users,
    });
  }

  navigation.push({
    name: 'Sair',
    href: '#',
    icon: LogOut,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header fixo com menu hambúrguer - Todas as resoluções */}
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 border-b border-sidebar-border bg-sidebar">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex flex-col h-full bg-sidebar">
              <div className="p-4 border-b border-sidebar-border">
                <img src={reconizeLogo} alt="Reconize" className="h-12 w-auto object-contain" />
              </div>

              <nav className="px-4 py-4 space-y-2 flex-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;

                  if (item.name === 'Sair') {
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          handleSignOut();
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-left"
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}

                <div className="pt-4 border-t border-sidebar-border mt-4">
                  <ChangePasswordModal />
                </div>
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <img src={reconizeLogo} alt="Reconize - Gestão Inteligente" className="h-10 w-auto object-contain" />
      </div>

      {/* Main content */}
      <div className="flex-1">
        <div className="p-2 md:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;