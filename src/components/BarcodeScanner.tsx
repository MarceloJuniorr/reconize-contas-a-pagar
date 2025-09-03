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
  const [permissionState, setPermissionState] = useState<'waiting' | 'loading' | 'granted' | 'denied' | 'error' | 'https-required'>('waiting');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      checkEnvironment();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isOpen]);

  const checkEnvironment = () => {
    // Verificar se está em HTTPS (obrigatório para câmera no mobile)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.error('HTTPS é obrigatório para câmera no mobile');
      setPermissionState('https-required');
      return;
    }

    // Verificar suporte do navegador
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('MediaDevices não suportado');
      setPermissionState('error');
      return;
    }

    // Pronto para solicitar permissão quando usuário clicar
    setPermissionState('waiting');
  };

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
    console.log('Iniciando solicitação de permissão da câmera...');
    console.log('User Agent:', navigator.userAgent);
    console.log('Protocolo:', location.protocol);
    console.log('Hostname:', location.hostname);
    
    try {
      setPermissionState('loading');
      
      // Verificar se o navegador suporta câmera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices não suportado pelo navegador');
        setPermissionState('error');
        return;
      }

      console.log('Solicitando acesso à câmera...');
      
      // Tentar câmera traseira primeiro, fallback para frontal
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { exact: 'environment' } // Câmera traseira obrigatória
          } 
        });
        console.log('Câmera traseira obtida com sucesso');
      } catch (envError) {
        console.warn('Câmera traseira não disponível, tentando qualquer câmera:', envError);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        console.log('Câmera alternativa obtida com sucesso');
      }
      
      streamRef.current = stream;
      setPermissionState('granted');
      console.log('Permissão concedida, inicializando scanner...');
      
      // Parar o stream temporário - o html5-qrcode criará o próprio
      stream.getTracks().forEach(track => track.stop());
      
      // Inicializar scanner após permissão concedida
      setTimeout(() => {
        initializeScanner();
      }, 100);
      
    } catch (error: any) {
      console.error('Erro detalhado de permissão da câmera:', error);
      console.error('Nome do erro:', error.name);
      console.error('Mensagem do erro:', error.message);
      
      if (error.name === 'NotAllowedError') {
        console.error('Permissão negada pelo usuário');
        setPermissionState('denied');
      } else if (error.name === 'NotFoundError') {
        console.error('Câmera não encontrada no dispositivo');
        setPermissionState('error');
        toast({
          title: "Câmera não encontrada",
          description: "Seu dispositivo não possui uma câmera disponível.",
          variant: "destructive",
        });
      } else if (error.name === 'NotReadableError') {
        console.error('Câmera já está sendo usada por outro aplicativo');
        setPermissionState('error');
        toast({
          title: "Câmera em uso",
          description: "A câmera está sendo usada por outro aplicativo.",
          variant: "destructive",
        });
      } else {
        console.error('Erro desconhecido:', error);
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
    setPermissionState('waiting');
    onClose();
  };

  const renderContent = () => {
    switch (permissionState) {
      case 'waiting':
        return (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <Camera className="h-12 w-12 mx-auto text-primary" />
                <div>
                  <h3 className="font-medium">Iniciar Scanner</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique no botão abaixo para solicitar acesso à câmera
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    É necessário permitir o acesso para escanear códigos de barras
                  </p>
                </div>
                <Button onClick={requestCameraPermission} className="w-full">
                  <Camera className="h-4 w-4 mr-2" />
                  Solicitar Acesso à Câmera
                </Button>
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

      case 'loading':
        return (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <RefreshCw className="h-12 w-12 mx-auto animate-spin text-primary" />
                <div>
                  <h3 className="font-medium">Solicitando permissão</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Permita o acesso à câmera na janela que apareceu
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    No mobile, o popup pode aparecer na parte superior da tela
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