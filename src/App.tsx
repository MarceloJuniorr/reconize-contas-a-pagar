import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Suppliers from "./pages/Suppliers";
import CostCenters from "./pages/CostCenters";
import AccountsPayable from "./pages/AccountsPayable";
import Users from "./pages/Users";
import Stores from "./pages/Stores";
import Products from "./pages/Products";
import Stock from "./pages/Stock";
import StockReceiptsList from "./pages/StockReceiptsList";
import StockReceipt from "./pages/StockReceipt";
import Customers from "./pages/Customers";
import PDV from "./pages/PDV";
import PaymentMethods from "./pages/PaymentMethods";
import SalesHistory from "./pages/SalesHistory";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Index />} />
              <Route path="accounts" element={<AccountsPayable />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="cost-centers" element={<CostCenters />} />
              <Route path="stores" element={<Stores />} />
              <Route path="products" element={<Products />} />
              <Route path="stock" element={<Stock />} />
              <Route path="stock/receipt" element={<StockReceiptsList />} />
              <Route path="stock/receipt/new" element={<StockReceipt />} />
              <Route path="customers" element={<Customers />} />
              <Route path="pdv" element={<PDV />} />
              <Route path="sales" element={<SalesHistory />} />
              <Route path="payment-methods" element={<PaymentMethods />} />
              <Route path="users" element={
                <ProtectedRoute requiredRole="admin">
                  <Users />
                </ProtectedRoute>
              } />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
