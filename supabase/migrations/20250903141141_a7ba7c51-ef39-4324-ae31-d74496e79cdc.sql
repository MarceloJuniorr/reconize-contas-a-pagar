-- Create function to automatically update account status when payment is created
CREATE OR REPLACE FUNCTION public.update_account_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the account status to 'pago' when a payment is inserted
  UPDATE public.accounts_payable 
  SET status = 'pago'::account_status, updated_at = now()
  WHERE id = NEW.account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to call the function after payment insertion
CREATE TRIGGER trigger_update_account_status_on_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_status_on_payment();