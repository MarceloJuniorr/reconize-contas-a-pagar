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
  const [scannerState, setScannerState] = useState<'loading' | 'ready' | 'error' | 'https-required'>('loading');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Pequeno delay para garantir que o DOM está pronto
      const timer = setTimeout(() => {
        checkEnvironmentAndInit();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      cleanup();
    }
  }, [isOpen]);

  const checkEnvironmentAndInit = () => {
    console.log('Verificando ambiente e inicializando scanner...');
    console.log('User Agent:', navigator.userAgent);
    console.log('Protocolo:', location.protocol);
    console.log('Hostname:', location.hostname);

    // Verificar se está em HTTPS (obrigatório para câmera no mobile)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.error('HTTPS é obrigatório para câmera no mobile');
      setScannerState('https-required');
      return;
    }

    // Verificar suporte do navegador
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('MediaDevices não suportado');
      setScannerState('error');
      return;
    }

    // Inicializar scanner diretamente - deixar a biblioteca gerenciar as permissões
    initializeScanner();
  };

  const cleanup = () => {
    console.log('Limpando scanner...');
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
  };

  const initializeScanner = () => {
    try {
      // Verificar se o elemento DOM existe
      const readerElement = document.getElementById("barcode-reader");
      if (!readerElement) {
        console.log('Elemento barcode-reader não encontrado, aguardando...');
        setTimeout(() => initializeScanner(), 200);
        return;
      }

      console.log('Inicializando HTML5QrcodeScanner...');
      
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
          // Configurações para otimizar para mobile
          rememberLastUsedCamera: false,
        },
        false // verbose = false
      );

      scanner.render(
        (decodedText) => {
          console.log('Código escaneado:', decodedText);
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Silenciar erros de scan contínuo (normal quando não há código na tela)
          if (!errorMessage.includes('NotFound') && !errorMessage.includes('No QR code found')) {
            console.warn('Scan error:', errorMessage);
          }
        }
      );

      scannerRef.current = scanner;
      setScannerState('ready');
      console.log('Scanner inicializado com sucesso');

    } catch (error) {
      console.error('Erro ao inicializar scanner:', error);
      setScannerState('error');
      toast({
        title: "Erro ao inicializar câmera",
        description: "Não foi possível inicializar o scanner. Verifique as permissões da câmera.",
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
    cleanup();
    setScannerState('loading');
    onClose();
  };

  const retryScanner = () => {
    console.log('Tentando novamente...');
    setScannerState('loading');
    cleanup();
    setTimeout(() => {
      checkEnvironmentAndInit();
    }, 500);
  };

  const renderContent = () => {
    switch (scannerState) {
      case 'loading':
        return (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <RefreshCw className="h-12 w-12 mx-auto animate-spin text-primary" />
                <div>
                  <h3 className="font-medium">Inicializando câmera</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Preparando o scanner de código de barras...
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Você pode ser solicitado a permitir o acesso à câmera
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'https-required':
        return (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                <div>
                  <h3 className="font-medium">HTTPS Necessário</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    O acesso à câmera requer conexão segura (HTTPS)
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Certifique-se de que está acessando o site via HTTPS
                  </p>
                </div>
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
                  <p className="text-xs text-muted-foreground mt-2">
                    Verifique se permitiu o acesso à câmera nas configurações do navegador
                  </p>
                </div>
                <Button onClick={retryScanner} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'ready':
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

          {scannerState !== 'ready' && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};