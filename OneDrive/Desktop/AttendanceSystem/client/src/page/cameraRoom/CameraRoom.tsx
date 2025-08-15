import React, { useState, useRef, useEffect } from 'react';
import { BrowserQRCodeReader, NotFoundException, ChecksumException, FormatException } from '@zxing/library';
import { Camera, Scan, CheckCircle, XCircle, Loader, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import axios from 'axios';

type ScanStatus = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface ScanResult {
  data: string;
  timestamp: Date;
}

const QRScanner: React.FC = () => {
  // State
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [positionHint, setPositionHint] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [torchEnabled, setTorchEnabled] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);

  // Initialize scanner
  const codeReader = new BrowserQRCodeReader();

  // Start camera and scanning
  const startScanning = async () => {
    try {
      setStatus('scanning');
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(torchEnabled && { advanced: [{ torch: true }] as any })
        }
      });

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      videoRef.current.style.transform = 'scaleX(-1)'; // Mirror preview

      // Use the decodeFromVideoElement method which returns a Promise<Result>
      const result = await codeReader.decodeFromVideoElement(videoRef.current);
      handleScanSuccess(result.getText());

    } catch (err) {
      if (err instanceof NotFoundException) {
        updatePositionHint();
      } else if (err instanceof ChecksumException || err instanceof FormatException) {
        handleScanError(err);
      } else {
        handleCameraError(err);
      }
    }
  };

  const handleScanSuccess = async (data: string) => {
    const result = { data, timestamp: new Date() };
    setScanResult(result);
    setStatus('processing');

    try {
      // Send to backend API
      const response = await axios.post('http://127.0.0.1:8000/auth/scan-qrCode', {
        attendance_id: data
      });

      if (response.data.success) {
        setStatus('success');
        setScanHistory(prev => [result, ...prev.slice(0, 4)]);
        setTimeout(startScanning, 2000);
      } else {
        throw new Error(response.data.message || 'API request failed');
      }
    } catch (err) {
      handleScanError(err instanceof Error ? err : new Error('API error'));
    }
  };



  // Handle scan errors
  const handleScanError = (err: Error) => {
    console.error('Scan error:', err);
    setError('Scan failed. Try again.');
    setStatus('error');
  };

  // Handle camera errors
  const handleCameraError = (err: unknown) => {
    console.error('Camera error:', err);
    setError('Camera access denied or unavailable');
    setStatus('error');
  };

  // Analyze frame to provide position hints
  const updatePositionHint = () => {
    if (!scanAreaRef.current) return;

    const scanRect = scanAreaRef.current.getBoundingClientRect();
    const viewportCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };

    const directions = [
      { name: 'Move left', icon: <ArrowLeft />, condition: scanRect.left > viewportCenter.x },
      { name: 'Move right', icon: <ArrowRight />, condition: scanRect.right < viewportCenter.x },
      { name: 'Move up', icon: <ArrowUp />, condition: scanRect.top > viewportCenter.y },
      { name: 'Move down', icon: <ArrowDown />, condition: scanRect.bottom < viewportCenter.y }
    ];

    const hint = directions.find(d => d.condition)?.name || null;
    setPositionHint(hint);
  };

  // Toggle torch/flashlight
  const toggleTorch = async () => {
    if (!videoRef.current?.srcObject) return;

    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];

    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchEnabled }] as any
      });
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.error('Torch not supported:', err);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="qr-scanner-container">
      {/* Camera Preview */}
      <div className="camera-preview">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`camera-feed ${status === 'processing' ? 'processing' : ''}`}
        />

        {/* Scan Area Overlay */}
        {status !== 'idle' && (
          <div className="scan-overlay">
            <div
              ref={scanAreaRef}
              className={`scan-frame ${status === 'success' ? 'success' : ''}`}
            >
              <div className="scan-frame-border" />
              <div className="scan-animation" />
            </div>

            {/* Status Indicator */}
            <div className="status-indicator">
              {status === 'scanning' && positionHint && (
                <div className="position-hint">
                  {positionHint.includes('left') && <ArrowLeft size={20} />}
                  {positionHint.includes('right') && <ArrowRight size={20} />}
                  {positionHint.includes('up') && <ArrowUp size={20} />}
                  {positionHint.includes('down') && <ArrowDown size={20} />}
                  <span>{positionHint}</span>
                </div>
              )}

              {status === 'processing' && (
                <div className="processing-indicator">
                  <Loader className="spin" size={20} />
                  <span>Processing...</span>
                </div>
              )}

              {status === 'success' && scanResult && (
                <div className="success-message">
                  <CheckCircle size={24} />
                  <span>Scanned successfully!</span>
                  <div className="scan-data">{scanResult.data}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && error && (
          <div className="error-overlay">
            <XCircle size={24} />
            <p>{error}</p>
            <button onClick={startScanning}>Retry</button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="scanner-controls">
        <button
          onClick={startScanning}
          disabled={status !== 'idle' && status !== 'error'}
        >
          {status === 'idle' ? 'Start Scanning' : 'Restart Scanner'}
        </button>

        {status !== 'idle' && (
          <button onClick={toggleTorch}>
            {torchEnabled ? 'Disable Flash' : 'Enable Flash'}
          </button>
        )}

        {scanHistory.length > 0 && (
          <div className="scan-history">
            <h3>Recent Scans:</h3>
            <ul>
              {scanHistory.map((item, i) => (
                <li key={i}>
                  <span className="scan-data">{item.data}</span>
                  <span className="scan-time">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <style>{`
        .qr-scanner-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #111;
          color: white;
        }
        
        .camera-preview {
          width:100%
          position: relative;
          flex-grow: 1;
          overflow: hidden;
        }
        
        .camera-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: flex;
          justify-content: center;
          
        }
        
        .camera-feed.processing {
          filter: blur(2px);
        }
        
        .scan-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: left;
          justify-content: center;
          background: rgba(0, 0, 0, 0.4);
        }
        
        .scan-frame {
          width: 70%;
          max-width: 300px;
          aspect-ratio: 1;
          border-radius: 16px;
          position: relative;
          transition: all 0.3s ease;
        }
        
        .scan-frame.success {
          border-color: #10b981;
        }
        
        .scan-frame-border {
          position: absolute;
          inset: 0;
          border: 4px solid #3b82f6;
          border-radius: 16px;
          animation: pulse 2s infinite;
          display: flex;
          
        }
        
        .scan-animation {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(to right, transparent, #3b82f6, transparent);
          animation: scan 2s linear infinite;
        }
        
        .status-indicator {
          margin-top: 20px;
          padding: 12px 20px;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 24px;
          text-align: center;
        }
        
        .position-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fbbf24;
        }
        
        .processing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #60a5fa;
        }
        
        .success-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #10b981;
        }
        
        .scan-data {
          font-family: monospace;
          word-break: break-all;
          text-align: center;
        }
        
        .error-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: rgba(0, 0, 0, 0.8);
          color: #ef4444;
        }
        
        .scanner-controls {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        button {
          padding: 12px;
          border-radius: 8px;
          border: none;
          background: #3b82f6;
          color: white;
          font-weight: bold;
          cursor: pointer;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .scan-history {
          margin-top: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }
        
        .scan-history ul {
          list-style: none;
          padding: 0;
          margin: 8px 0 0;
        }
        
        .scan-history li {
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .scan-time {
          display: block;
          font-size: 0.8em;
          color: #9ca3af;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default QRScanner;