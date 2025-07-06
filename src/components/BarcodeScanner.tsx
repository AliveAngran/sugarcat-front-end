"use client";

import { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      readerRef.current = new BrowserMultiFormatReader();
      startScanner();
    }

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, []);

  const startScanner = async () => {
    if (!readerRef.current || !videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoRef.current.srcObject = stream;
      
      readerRef.current.decodeFromStream(stream, videoRef.current, (result, err) => {
        if (result) {
          onScan(result.getText());
          onClose(); // Automatically close after a successful scan
        }
        if (err && !(err instanceof NotFoundException)) {
          console.error('Barcode scan error:', err);
        }
      });

    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('无法访问摄像头。请确保您已授权，并且没有其他应用正在使用摄像头。');
      onClose();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={overlayStyle}></div>
      <div style={instructionsStyle}>请将条形码对准扫描框</div>
    </div>
  );
};

// --- Styles ---
const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '80%',
  height: '30%',
  transform: 'translate(-50%, -50%)',
  border: '2px solid red',
  borderRadius: '10px',
  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
};

const instructionsStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '8px 16px',
    borderRadius: '5px',
    textAlign: 'center'
};

export default BarcodeScanner;
