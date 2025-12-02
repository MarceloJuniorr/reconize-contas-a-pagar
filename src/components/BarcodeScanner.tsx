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

    // Não chamar getUserMedia aqui - deixar ZXing gerenciar
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

      console.log('Iniciando decodeFromVideoDevice...');

      // decodeFromVideoDevice com callback
      await codeReader.decodeFromVideoDevice(
        undefined, // camera id undefined = seleciona automaticamente
        videoEl,
        (result, err) => {
          if (result) {
            const decodedText = result.getText();
            console.log('✅ Código detectado:', decodedText);
            handleDetected(decodedText);
          }

          if (err) {
            const name = String(err.name || '');
            const msg = String(err.message || '');
            const isNotFound = /notfound/i.test(name) || /notfound/i.test(msg);

            if (!isNotFound) {
              console.warn('⚠️ ZXing decode error:', msg);
            }
          }
        }
      );

      setScannerState('ready');
      console.log('✅ ZXing iniciado com sucesso');

    } catch (err) {
      console.error('❌ initZXing erro:', err);
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
    console.log('🔍 handleDetected - valor bruto:', decodedText);

    if (!decodedText) {
      console.warn('⚠️ Texto decodificado vazio');
      return;
    }

    // Remove espaços e caracteres especiais, mantém só números
    const clean = decodedText.replace(/\D/g, '');
    console.log('🔍 Código limpo (só números):', clean, 'tamanho:', clean.length);

    // Boleto bancário: 47 dígitos (linha digitável) ou 44 dígitos (código de barras)
    // Também aceita outros tamanhos comuns de boletos
    if (clean.length === 44 || clean.length === 47 || clean.length === 48) {
      console.log('✅ Código válido detectado! Enviando...', clean);
      onScan(clean);
      toast({
        title: 'Código escaneado com sucesso!',
        description: `Código de ${clean.length} dígitos detectado.`,
      });
      stopAll();
      onClose();
    } else {
      console.warn('⚠️ Código com tamanho inválido:', clean.length, 'dígitos');
      toast({
        title: 'Código detectado',
        description: `Código com ${clean.length} dígitos. Esperado: 44, 47 ou 48 dígitos.`,
        variant: 'destructive',
      });
    }
  };

  const stopAll = async () => {
    console.log('🛑 BarcodeScanner: stopAll');

    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
        console.log('✅ CodeReader resetado');
      } catch (e) {
        console.warn('⚠️ Erro reset codeReader:', e);
      }
      codeReaderRef.current = null;
    }

    if (videoRef.current) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('✅ Track parada:', track.label);
          });
        }
        videoRef.current.srcObject = null;
      } catch (e) {
        console.warn('⚠️ Erro limpar videoRef:', e);
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
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-primary">
                  📷 Câmera ativa
                </p>
                <p className="text-sm text-muted-foreground">
                  Aponte para o código de barras do boleto
                </p>
                <p className="text-xs text-muted-foreground">
                  Mantenha o código centralizado e bem iluminado
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
        {/* Vídeo sempre presente */}
        <video
          ref={videoRef}
          style={{
            display: 'block',
            visibility: scannerState === 'ready' ? 'visible' : 'hidden',
            opacity: scannerState === 'ready' ? 1 : 0,
            width: '100%',
            minHeight: 300,
            maxHeight: 400,
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