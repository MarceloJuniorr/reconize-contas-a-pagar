import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { X, Camera, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export const BarcodeScanner = ({ isOpen, onClose, onScan }: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [scannerState, setScannerState] = useState<'loading' | 'ready' | 'error' | 'https-required'>('loading');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setScannerState('loading');
      // carrega dispositivos de vídeo
      loadVideoDevices();
      setTimeout(() => startFlow(), 100);
    } else {
      stopAll();
    }

    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadVideoDevices = async () => {
    try {
      // garantir permissão antes de enumerar (alguns browsers só mostram labels após permissão)
      await navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        stream.getTracks().forEach(t => t.stop());
      }).catch(() => { });
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all.filter(d => d.kind === 'videoinput');
      setDevices(videoInputs);
      // escolher automaticamente traseira se houver
      const back = videoInputs.find(d => /back|traseir|rear|environment/i.test(d.label));
      setSelectedDeviceId((back?.deviceId || videoInputs[0]?.deviceId) ?? undefined);
    } catch (e) {
      console.warn('Falha ao listar câmeras:', e);
    }
  };

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

      const tryStart = async (deviceId?: string, hint?: string) => {
        console.log('Iniciando decodeFromVideoDevice...', deviceId || '(auto)', hint || '');
        try {
          await codeReader.decodeFromVideoDevice(
            deviceId,
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
                if (!isNotFound) console.warn('⚠️ ZXing decode error:', msg);
              }
            }
          );
          return true;
        } catch (e) {
          console.warn(`Falha ao iniciar com ${hint || (deviceId ? 'deviceId' : 'auto')}:`, e);
          await stopAll();
          return false;
        }
      };

      // 1) tenta deviceId selecionado
      let ok = await tryStart(selectedDeviceId, 'deviceId selecionado');

      // 2) fallback: facingMode environment via getUserMedia manual, colando stream no <video>
      if (!ok) {
        try {
          console.log('Tentando fallback getUserMedia facingMode: environment');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
          // aplica stream manualmente
          videoEl.srcObject = stream;
          videoEl.muted = true;
          // iOS precisa playsInline + autoPlay + gesto; já definido no elemento
          await videoEl.play().catch(err => console.warn('video.play falhou:', err));
          // depois pede ao ZXing para ler do elemento de vídeo atual (sem abrir dispositivo)
          console.log('Iniciando decodeFromVideoElement (stream já ativo)');
          await codeReader.decodeFromVideoDevice(
            undefined, // não force deviceId, ZXing só lerá o vídeo atual
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
                if (!isNotFound) console.warn('⚠️ ZXing decode error:', msg);
              }
            }
          );
          ok = true;
        } catch (e) {
          console.warn('Fallback getUserMedia environment falhou:', e);
          await stopAll();
          ok = false;
        }
      }

      // 3) último fallback: auto (sem deviceId)
      if (!ok) {
        ok = await tryStart(undefined, 'auto (sem deviceId)');
      }

      if (!ok) {
        throw new Error('Não foi possível iniciar a câmera no dispositivo (após todas as tentativas)');
      }

      setScannerState('ready');
      console.log('✅ Scanner iniciado com sucesso');

    } catch (err) {
      console.error('❌ initZXing erro:', err);
      setScannerState('error');
      toast({
        title: 'Erro ao iniciar câmera',
        description: String((err as Error).message || err),
        variant: 'destructive',
      });
      await stopAll();
    }
  };

  // troca de câmera: para fluxo e reinicia
  const handleChangeCamera = async (deviceId: string) => {
    try {
      setSelectedDeviceId(deviceId);
      await stopAll();
      setScannerState('loading');
      await initZXing();
    } catch (e) {
      console.warn('Erro ao trocar câmera:', e);
      toast({
        title: 'Erro ao trocar câmera',
        description: String((e as Error).message || e),
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
              <div className="space-y-3">
                {devices.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Câmera:</span>
                    <Select
                      value={selectedDeviceId || ''}
                      onValueChange={(val) => handleChangeCamera(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a câmera" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId}>
                            {d.label || `Câmera ${d.deviceId.slice(0, 6)}...`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Aponte para o código de barras do boleto
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dica: escolha "traseira" para melhor foco (em celulares)
                  </p>
                </div>
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