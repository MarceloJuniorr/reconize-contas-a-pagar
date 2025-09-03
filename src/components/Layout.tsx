import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Building2, MapPin, LogOut, Users, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
const Layout = () => {
  const {
    signOut,
    hasRole
  } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigation = [{
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard
  }, {
    name: 'Contas a Pagar',
    href: '/accounts',
    icon: FileText
  }, {
    name: 'Fornecedores',
    href: '/suppliers',
    icon: Building2
  }, {
    name: 'Centros de Custo',
    href: '/cost-centers',
    icon: MapPin
  }];
  if (hasRole('admin')) {
    navigation.push({
      name: 'Usuários',
      href: '/users',
      icon: Users
    });
  }
  const handleSignOut = async () => {
    await signOut();
  };
  return <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-sidebar-border bg-sidebar">
        <h1 className="text-lg font-bold text-sidebar-foreground">RECONIZE</h1>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex flex-col h-full bg-sidebar">
              <div className="p-6">
                <h1 className="text-xl font-bold text-sidebar-foreground">RECONIZE</h1>
              </div>
              
              <nav className="px-4 space-y-2 flex-1">
                {navigation.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return <Link 
                    key={item.name} 
                    to={item.href} 
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors', isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}>
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Link>;
                })}
              </nav>
              
              <div className="p-4">
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:flex md:w-64 bg-sidebar border-r border-sidebar-border flex-col">
          <div className="p-6">
            <h1 className="text-xl font-bold text-sidebar-foreground">RECONIZE</h1>
          </div>
          
          <nav className="px-4 space-y-2 flex-1">
            {navigation.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return <Link key={item.name} to={item.href} className={cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors', isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}>
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>;
          })}
          </nav>
          
          <div className="p-4">
            <Button variant="outline" onClick={handleSignOut} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1">
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>;
};
export default Layout;