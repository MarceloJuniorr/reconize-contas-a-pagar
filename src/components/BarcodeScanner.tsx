import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { X, Camera, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export const BarcodeScanner = ({ isOpen, onClose, onScan }: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const decoderRef = useRef<any | null>(null);
  const [scannerState, setScannerState] = useState<'loading' | 'ready' | 'error' | 'https-required'>('loading');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setScannerState('loading');
      setTimeout(() => startFlow(), 100);
    } else {
      stopAll();
    }

    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startFlow = async () => {
    console.log('BarcodeScanner: startFlow');

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setScannerState('https-required');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('MediaDevices não suportado');
      setScannerState('error');
      return;
    }

    try {
      // solicita permissão explicitamente
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.error('Permissão negada:', err);
      setScannerState('error');
      toast({
        title: 'Permissão de câmera necessária',
        description: 'Permita o acesso à câmera para escanear boletos.',
        variant: 'destructive',
      });
      return;
    }

    await initZXing();
  };

  const initZXing = async () => {
    try {
      const videoEl = videoRef.current;
      if (!videoEl) {
        console.error('videoRef não definido');
        setScannerState('error');
        return;
      }

      console.log('Inicializando ZXing BrowserMultiFormatReader...');

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      // decodeFromVideoDevice = camera automática, contínuo
      const decoderPromise = codeReader.decodeFromVideoDevice(
        undefined, // camera id undefined = seleciona automaticamente
        videoEl,
        (result: any, err: any) => {
          if (result) {
            const decodedText = result.text;
            console.log('Código detectado:', decodedText);
            handleDetected(decodedText);
            return;
          }

          if (err) {
            const name = String(err.name || '');
            const msg = String(err.message || err);
            const isNotFound = /notfound/i.test(name) || /notfound/i.test(msg);
            if (!isNotFound) {
              console.warn('ZXing decode error:', msg);
            }
          }
        }
      );

      // tenta garantir que o vídeo seja reproduzido e visível
      decoderRef.current = decoderPromise;
      // aguarda curto período para o stream ser ligado
      setTimeout(async () => {
        try {
          const s = videoEl.srcObject as MediaStream | null;
          console.log('video.srcObject após start:', s);
          if (s && s.getTracks && s.getTracks().length > 0) {
            // tenta tocar o vídeo (some browsers exigem play() explícito)
            await videoEl.play().catch((e) => console.warn('video.play() falhou:', e));
            console.log('video.play() chamado');
          } else {
            console.warn('Nenhuma track encontrada no srcObject ainda');
          }
        } catch (e) {
          console.warn('Erro ao forçar play do vídeo:', e);
        }
      }, 500);

      setScannerState('ready');
      console.log('ZXing iniciado com sucesso');

    } catch (err) {
      console.error('initZXing erro:', err);
      setScannerState('error');
      toast({
        title: 'Erro ao inicializar scanner',
        description: String((err as Error).message || err),
        variant: 'destructive',
      });
      stopAll();
    }
  };

  const handleDetected = (rawValue: string) => {
    const decodedText = String(rawValue || '').trim();
    console.log('handleDetected:', decodedText);
    if (!decodedText) return;

    // valida boleto: 44 ou 47 dígitos numéricos
    const clean = decodedText.replace(/\D/g, '');
    if (clean.length === 44 || clean.length === 47) {
      onScan(clean);
      toast({
        title: 'Código escaneado',
        description: 'Código detectado com sucesso.',
      });
      stopAll();
      onClose();
    } else {
      toast({
        title: 'Código inválido',
        description: 'O código escaneado não é um boleto brasileiro válido.',
        variant: 'destructive',
      });
    }
  };

  const stopAll = async () => {
    console.log('BarcodeScanner: stopAll');

    if (decoderRef.current) {
      try {
        await decoderRef.current;
      } catch (e) {
        console.warn('Erro parar decoder:', e);
      }
      decoderRef.current = null;
    }

    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (e) {
        console.warn('Erro reset codeReader:', e);
      }
      codeReaderRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch (e) {
        console.warn('Erro limpar videoRef', e);
      }
    }

    setScannerState('loading');
  };

  const retryScanner = () => {
    stopAll();
    setTimeout(() => startFlow(), 300);
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
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Aponte a câmera para o código de barras do boleto
                </p>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { stopAll(); onClose(); }}>
      <DialogContent className="w-[95vw] max-w-md p-4">
        {/* único elemento <video> no DOM — sempre presente (visível quando ready) */}
        <video
          ref={videoRef}
          style={{
            display: 'block', // nunca remova do fluxo para não impedir inicialização do stream
            visibility: scannerState === 'ready' ? 'visible' : 'hidden',
            opacity: scannerState === 'ready' ? 1 : 0,
            width: '100%',
            minHeight: 300,
            backgroundColor: '#000',
            objectFit: 'cover',
            borderRadius: '0.5rem',
          }}
          playsInline
          muted
          autoPlay
        />
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Escanear Código de Barras
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { stopAll(); onClose(); }}
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
              <Button variant="outline" onClick={() => { stopAll(); onClose(); }} className="flex-1">
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};