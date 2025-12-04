import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { X, Camera, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export const BarcodeScanner = ({ isOpen, onClose, onScan }: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [scannerState, setScannerState] = useState<'loading' | 'ready' | 'error' | 'https-required'>('loading');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setScannerState('loading');
      loadVideoDevices();
      setTimeout(() => startFlow(), 100);
      navigator.mediaDevices?.addEventListener?.('devicechange', loadVideoDevices);
    } else {
      stopAll();
      navigator.mediaDevices?.removeEventListener?.('devicechange', loadVideoDevices);
    }
    return () => {
      stopAll();
      navigator.mediaDevices?.removeEventListener?.('devicechange', loadVideoDevices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadVideoDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all.filter(d => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (!selectedDeviceId && videoInputs.length > 0) {
        const back = videoInputs.find(d => /back|traseir|rear|environment/i.test(d.label));
        setSelectedDeviceId((back?.deviceId || videoInputs[0]?.deviceId) ?? undefined);
      }
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
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error('MediaDevices não suportado');
      setScannerState('error');
      return;
    }
    await initZXing();
  };

  const stopStreamsOnly = async () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    const v = videoRef.current;
    if (v?.srcObject) {
      try {
        (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      } catch { }
      v.srcObject = null;
    }
    if (codeReaderRef.current) {
      codeReaderRef.current = null;
    }
  };

  const initZXing = async () => {
    try {
      const videoEl = videoRef.current;
      const canvasEl = canvasRef.current;
      if (!videoEl || !canvasEl) {
        console.error('videoRef ou canvasRef não definido');
        setScannerState('error');
        return;
      }

      await stopStreamsOnly();

      // Hints focando em formatos de boleto
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.ITF,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const codeReader = new BrowserMultiFormatReader(hints);
      codeReaderRef.current = codeReader;

      const tryConstraints = async (constraints: MediaStreamConstraints, hint: string) => {
        console.log('Tentando constraints:', hint, constraints);
        try {
          await stopStreamsOnly();
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          videoEl.srcObject = stream;
          videoEl.muted = true;
          await videoEl.play().catch(err => console.warn('video.play falhou:', err));
          return true;
        } catch (e) {
          console.warn('Falha getUserMedia:', hint, e);
          await stopStreamsOnly();
          await new Promise(r => setTimeout(r, 300));
          return false;
        }
      };

      // Tentativas de constraints
      let ok = false;
      if (selectedDeviceId) {
        ok = await tryConstraints(
          {
            audio: false,
            video: {
              deviceId: { exact: selectedDeviceId },
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            } as MediaTrackConstraints
          },
          'deviceId exato'
        );
      }

      if (!ok) {
        ok = await tryConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          },
          'facingMode environment'
        );
      }

      if (!ok) {
        ok = await tryConstraints({ video: true, audio: false }, 'genérica');
      }

      if (!ok) throw new Error('Não foi possível iniciar a câmera após fallbacks');

      // Iniciar loop de scan com ROI
      startScanLoop(videoEl, canvasEl, codeReader);
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
      await stopStreamsOnly();
    }
  };

  const startScanLoop = (video: HTMLVideoElement, canvas: HTMLCanvasElement, reader: BrowserMultiFormatReader) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scan = async () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Define ROI: região central (70% largura, 50% altura)
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const roiWidth = Math.floor(vw * 0.7);
        const roiHeight = Math.floor(vh * 0.5);
        const roiX = Math.floor((vw - roiWidth) / 2);
        const roiY = Math.floor((vh - roiHeight) / 2);

        // Ajusta canvas para ROI
        canvas.width = roiWidth;
        canvas.height = roiHeight;

        // Desenha região ROI do vídeo no canvas
        ctx.drawImage(
          video,
          roiX, roiY, roiWidth, roiHeight, // source
          0, 0, roiWidth, roiHeight         // dest
        );

        try {
          const result = await reader.decodeFromCanvas(canvas);
          if (result) {
            const decodedText = result.getText();
            console.log('✅ Código detectado (ROI):', decodedText);
            const clean = String(decodedText).replace(/\D/g, '');
            if (clean.length === 44 || clean.length === 47) {
              handleDetected(clean);
            }
          }
        } catch (err) {
          // NotFoundException esperado quando não há código
          const msg = String(err?.message || err);
          if (!/notfound/i.test(msg)) {
            console.warn('⚠️ Decode error:', msg);
          }
        }
      }
    };

    scanIntervalRef.current = window.setInterval(scan, 300);
  };

  const handleDetected = (cleanCode: string) => {
    console.log('🔍 handleDetected:', cleanCode);
    onScan(cleanCode);
    toast({
      title: 'Código escaneado com sucesso!',
      description: `Código de ${cleanCode.length} dígitos detectado.`,
    });
    stopAll();
    onClose();
  };

  const handleChangeCamera = async (deviceId: string) => {
    try {
      setSelectedDeviceId(deviceId);
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
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (codeReaderRef.current) {
      codeReaderRef.current = null;
      console.log('✅ CodeReader limpo');
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
                  <p className="text-sm font-medium text-primary">
                    📷 Centralize o código de barras na área destacada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mantenha bem iluminado e estável
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
        <div style={{ position: 'relative', width: '100%' }}>
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
          {/* Overlay ROI */}
          {scannerState === 'ready' && (
            <div
              style={{
                position: 'absolute',
                top: '25%',
                left: '15%',
                width: '70%',
                height: '50%',
                border: '2px solid #22c55e',
                borderRadius: '8px',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Canvas oculto para ROI */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

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