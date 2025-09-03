import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { X, Camera, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export const BarcodeScanner = ({ isOpen, onClose, onScan }: BarcodeScannerProps) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied' | 'error'>('loading');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      requestCameraPermission();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isOpen]);

  const cleanup = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const requestCameraPermission = async () => {
    try {
      setPermissionState('loading');
      
      // Verificar se o navegador suporta câmera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionState('error');
        return;
      }

      // Solicitar permissão explicitamente
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Preferir câmera traseira
      });
      
      streamRef.current = stream;
      setPermissionState('granted');
      
      // Parar o stream temporário - o html5-qrcode criará o próprio
      stream.getTracks().forEach(track => track.stop());
      
      // Inicializar scanner após permissão concedida
      setTimeout(() => {
        initializeScanner();
      }, 100);
      
    } catch (error: any) {
      console.error('Erro de permissão da câmera:', error);
      
      if (error.name === 'NotAllowedError') {
        setPermissionState('denied');
      } else if (error.name === 'NotFoundError') {
        setPermissionState('error');
        toast({
          title: "Câmera não encontrada",
          description: "Seu dispositivo não possui uma câmera disponível.",
          variant: "destructive",
        });
      } else {
        setPermissionState('error');
        toast({
          title: "Erro de câmera",
          description: "Não foi possível acessar a câmera.",
          variant: "destructive",
        });
      }
    }
  };

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
    } catch (error) {
      console.error('Erro ao inicializar scanner:', error);
      setPermissionState('error');
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
    cleanup();
    setPermissionState('loading');
    onClose();
  };

  const renderContent = () => {
    switch (permissionState) {
      case 'loading':
        return (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <RefreshCw className="h-12 w-12 mx-auto animate-spin text-primary" />
                <div>
                  <h3 className="font-medium">Solicitando permissão</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Permita o acesso à câmera para escanear o código de barras
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'denied':
        return (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                <div>
                  <h3 className="font-medium">Permissão negada</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    É necessário permitir o acesso à câmera para escanear códigos de barras
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Você pode habilitar nas configurações do navegador ou tentar novamente
                  </p>
                </div>
                <Button onClick={requestCameraPermission} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'error':
        return (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                <div>
                  <h3 className="font-medium">Erro de câmera</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não foi possível acessar a câmera do dispositivo
                  </p>
                </div>
                <Button onClick={requestCameraPermission} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'granted':
        return (
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
        );

      default:
        return null;
    }
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
          {renderContent()}

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