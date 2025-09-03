import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { X, Camera, SwitchCamera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export const BarcodeScanner = ({ isOpen, onClose, onScan }: BarcodeScannerProps) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && !scannerRef.current) {
      initializeScanner();
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const initializeScanner = async () => {
    try {
      const scanner = new Html5QrcodeScanner(
        "barcode-reader",
        {
          fps: 10,
          qrbox: { width: 300, height: 150 },
          aspectRatio: 2.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Silenciar erros de scan contínuo
          if (!errorMessage.includes('NotFound')) {
            console.warn('Scan error:', errorMessage);
          }
        }
      );

      scannerRef.current = scanner;
      setIsScanning(true);
    } catch (error) {
      console.error('Erro ao inicializar scanner:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar a câmera. Verifique as permissões.",
        variant: "destructive",
      });
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    // Validar se é um código de boleto brasileiro
    const cleanCode = decodedText.replace(/\D/g, '');
    
    if (cleanCode.length === 44 || cleanCode.length === 47) {
      onScan(cleanCode);
      handleClose();
      
      // Vibração no celular (se suportado)
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      toast({
        title: "Código escaneado",
        description: "Código de barras detectado com sucesso!",
      });
    } else {
      toast({
        title: "Código inválido",
        description: "O código escaneado não é um boleto brasileiro válido.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setIsScanning(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Escanear Código de Barras
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Aponte a câmera para o código de barras do boleto
                </p>
                <div 
                  id="barcode-reader" 
                  className="w-full"
                  style={{ minHeight: '300px' }}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};