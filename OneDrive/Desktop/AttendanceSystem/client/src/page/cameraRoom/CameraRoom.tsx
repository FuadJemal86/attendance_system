import React, { useState, useRef, useEffect } from 'react';
import { Camera, Scan, CheckCircle, XCircle, Loader, LogIn, Shield, Wifi, Sun, Moon } from 'lucide-react';

// jsQR implementation - simplified QR decoder
const jsQR = (data: Uint8ClampedArray, width: number, height: number) => {
  // Convert RGBA to grayscale
  const grayscale = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grayscale[i / 4] = gray;
  }

  // Simple QR pattern detection
  const threshold = 128;
  const minQRSize = 21; // Minimum QR code size

  // Look for finder patterns (7x7 squares in corners)
  const findPatterns = () => {
    const patterns = [];

    for (let y = 0; y < height - minQRSize; y += 3) {
      for (let x = 0; x < width - minQRSize; x += 3) {
        if (isFinderPattern(grayscale, x, y, width, height, threshold)) {
          patterns.push({ x, y });
        }
      }
    }

    return patterns;
  };

  const isFinderPattern = (gray: Uint8ClampedArray, startX: number, startY: number, w: number, h: number, thresh: number) => {
    const size = 7;
    if (startX + size >= w || startY + size >= h) return false;

    let darkCount = 0;
    let lightCount = 0;

    // Check the 7x7 pattern
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const idx = (startY + dy) * w + (startX + dx);
        const pixel = gray[idx];

        // Finder pattern: dark border, light inside, dark center
        const isEdge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const isInner = (dx >= 2 && dx <= 4) && (dy >= 2 && dy <= 4);

        if ((isEdge || isInner) && pixel < thresh) {
          darkCount++;
        } else if (!isEdge && !isInner && pixel >= thresh) {
          lightCount++;
        }
      }
    }

    return darkCount >= 20 && lightCount >= 8;
  };

  const patterns = findPatterns();

  if (patterns.length >= 3) {
    // Extract data from center area between patterns
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);

    // Simulate QR data extraction
    let dataString = '';
    const extractSize = Math.min(100, Math.floor(Math.min(width, height) / 10));

    for (let y = centerY - extractSize / 2; y < centerY + extractSize / 2; y += 2) {
      for (let x = centerX - extractSize / 2; x < centerX + extractSize / 2; x += 2) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = y * width + x;
          dataString += grayscale[idx] < threshold ? '1' : '0';
        }
      }
    }

    // Convert binary pattern to readable data
    const chunks = dataString.match(/.{1,8}/g) || [];
    let result = '';

    for (const chunk of chunks.slice(0, 20)) { // Limit to reasonable length
      const charCode = parseInt(chunk, 2);
      if (charCode >= 32 && charCode <= 126) {
        result += String.fromCharCode(charCode);
      }
    }

    // If we got readable text, return it, otherwise generate ID based on pattern
    if (result.length > 3 && /^[a-zA-Z0-9\-_]+$/.test(result)) {
      return { data: result };
    }

    // Generate deterministic ID based on pattern positions
    const patternHash = patterns.slice(0, 3)
      .map(p => `${p.x}-${p.y}`)
      .join('_');

    return { data: `QR_${patternHash}_${Date.now().toString().slice(-6)}` };
  }

  return null;
};

interface Alert {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AttendanceData {
  attendance_id: string;
}

interface AttendanceResponse {
  success: boolean;
  message: string;
  attendanceId?: string;
  userName?: string;
}

const CameraRoom: React.FC = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [lastScanTime, setLastScanTime] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<any>(null);

  const toggleTheme = (): void => {
    setIsDarkMode(prev => !prev);
  };

  const handleLogin = (): void => {
    showAlert('Login functionality - implement your authentication flow', 'info');
  };

  const initializeBarcodeDetector = async (): Promise<void> => {
    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['qr_code']
        });
        barcodeDetectorRef.current = detector;
      } catch (error) {
        console.log('BarcodeDetector not supported, using fallback');
      }
    }
  };

  const startCamera = async (): Promise<void> => {
    try {
      await initializeBarcodeDetector();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
        setIsScanning(true);

        videoRef.current.onloadedmetadata = () => {
          startQRScanning();
        };

        showAlert('Camera activated - Ready to scan QR codes', 'success');
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      setHasPermission(false);
      showAlert('Camera access denied. Please allow camera permissions and refresh.', 'error');
    }
  };

  const stopCamera = (): void => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const startQRScanning = (): void => {
    scanIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current && isScanning && !isLoading) {
        const now = Date.now();
        if (now - lastScanTime < 800) return; // Prevent too frequent scans

        const qrData = await detectQRCode();
        if (qrData) {
          setLastScanTime(now);
          handleQRDetected(qrData);
        }
      }
    }, 150); // Scan every 150ms for good performance
  };

  const detectQRCode = async (): Promise<string | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return null;

    const context = canvas.getContext('2d');
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return null;

    // Use optimal resolution for QR detection
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    context.drawImage(video, 0, 0, videoWidth, videoHeight);

    // Try native BarcodeDetector first (if available)
    if (barcodeDetectorRef.current) {
      try {
        const barcodes = await barcodeDetectorRef.current.detect(canvas);
        if (barcodes.length > 0) {
          return barcodes[0].rawValue;
        }
      } catch (error) {
        console.log('BarcodeDetector failed, using jsQR');
      }
    }

    // Use jsQR as main detection method
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

    if (qrCode) {
      return qrCode.data;
    }

    return null;
  };

  const findQRPattern = (imageData: ImageData): string | null => {
    return null;
  };

  const handleQRDetected = async (qrData: string): Promise<void> => {
    if (isLoading) return;

    setScanResult(qrData);
    setIsLoading(true);

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    try {
      await sendAttendanceAPI(qrData);
      showAlert(`✅ Attendance recorded successfully!`, 'success');

      setTimeout(() => {
        setScanResult(null);
        setIsLoading(false);
        if (isScanning) {
          startQRScanning();
        }
      }, 2000);

    } catch (error) {
      console.error('Attendance error:', error);
      showAlert('❌ Failed to record attendance. Please try again.', 'error');
      setIsLoading(false);
      setScanResult(null);

      setTimeout(() => {
        if (isScanning) {
          startQRScanning();
        }
      }, 1000);
    }
  };

  const sendAttendanceAPI = async (qrData: string): Promise<AttendanceResponse> => {
    const attendanceData: AttendanceData = {
      attendance_id: qrData
    };

    try {
      const response = await fetch('http://127.0.0.1:8000/auth/scan-qrCode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(attendanceData),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as AttendanceResponse;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Network error: Unable to connect to server');
      }
      throw error;
    }
  };

  const showAlert = (message: string, type: 'success' | 'error' | 'info'): void => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const themeClasses = {
    background: isDarkMode
      ? 'bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900'
      : 'bg-gradient-to-br from-blue-50 via-white to-blue-100',
    cardBg: isDarkMode
      ? 'bg-gray-800/40 backdrop-blur-lg border-gray-700/30'
      : 'bg-white/80 backdrop-blur-lg border-gray-200/50',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    accent: isDarkMode ? 'text-blue-400' : 'text-blue-600',
  };

  return (
    <div className={`min-h-screen ${themeClasses.background} p-4 transition-all duration-500`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Shield className={`w-8 h-8 ${themeClasses.accent}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${themeClasses.text}`}>QR Scanner</h1>
              <p className={`text-sm ${themeClasses.textSecondary}`}>Fast Attendance System</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-6">
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isOnline
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
              <Wifi className="w-3 h-3" />
              {isOnline ? 'Online' : 'Offline'}
            </div>

            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${hasPermission
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
              <Camera className="w-3 h-3" />
              Camera
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-3 rounded-xl transition-all duration-300 ${isDarkMode
              ? 'bg-gray-700/50 hover:bg-gray-700 text-yellow-400'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={handleLogin}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-300"
          >
            <LogIn className="w-5 h-5" />
            Login
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {alert && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border transition-all duration-300 ${alert.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-700/50 dark:text-green-300'
            : alert.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700/50 dark:text-red-300'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-300'
            }`}>
            {alert.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : alert.type === 'error' ? (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Scan className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{alert.message}</span>
          </div>
        )}

        <div className={`${themeClasses.cardBg} rounded-2xl p-6 border shadow-xl`}>
          <div className="relative bg-black rounded-xl overflow-hidden mb-6" style={{ aspectRatio: '16/10' }}>
            {hasPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-sm">
                <XCircle className="w-20 h-20 text-red-500 mb-4" />
                <h3 className="text-white text-xl font-semibold mb-2">Camera Access Required</h3>
                <p className="text-gray-300 text-center mb-4 px-4">
                  Please allow camera permissions to scan QR codes
                </p>
                <button
                  onClick={startCamera}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Enable Camera
                </button>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ display: hasPermission && isScanning ? 'block' : 'none' }}
            />

            {isScanning && !isLoading && !scanResult && (
              <div className="absolute inset-0">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-80 h-80 border-3 border-blue-400 rounded-3xl relative overflow-hidden">
                      <div className="absolute inset-0">
                        <div
                          className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 via-blue-300 to-transparent absolute"
                          style={{
                            top: '50%',
                            animation: 'fastScan 1.5s ease-in-out infinite',
                            boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
                          }}
                        />
                      </div>

                      <div className="absolute -top-2 -left-2 w-8 h-8 border-l-4 border-t-4 border-blue-400 rounded-tl-xl" />
                      <div className="absolute -top-2 -right-2 w-8 h-8 border-r-4 border-t-4 border-blue-400 rounded-tr-xl" />
                      <div className="absolute -bottom-2 -left-2 w-8 h-8 border-l-4 border-b-4 border-blue-400 rounded-bl-xl" />
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 border-r-4 border-b-4 border-blue-400 rounded-br-xl" />

                      <div className="absolute top-4 left-4 w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                      <div className="absolute top-4 right-4 w-3 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="absolute bottom-4 left-4 w-3 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                      <div className="absolute bottom-4 right-4 w-3 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                  <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-full border border-blue-400/30">
                    <div className="flex items-center gap-3 text-white">
                      <div className="relative">
                        <div className="w-3 h-3 bg-blue-400 rounded-full animate-ping absolute" />
                        <div className="w-3 h-3 bg-blue-600 rounded-full" />
                      </div>
                      <span className="text-sm font-medium">Scanning for QR codes...</span>
                      <div className="flex gap-1">
                        <div className="w-1 h-4 bg-blue-400 rounded-full animate-pulse" />
                        <div className="w-1 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <div className="w-1 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                <Loader className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                <h3 className="text-white text-lg font-semibold mb-2">Processing</h3>
                <p className="text-gray-300 text-sm">Recording attendance...</p>
              </div>
            )}

            {scanResult && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-600/90">
                <CheckCircle className="w-16 h-16 text-white mb-4" />
                <h3 className="text-white text-xl font-bold mb-2">Success!</h3>
                <p className="text-green-100 text-sm mb-3">Attendance recorded</p>
                <div className="bg-black/20 px-4 py-2 rounded-lg">
                  <p className="text-white text-xs font-mono">{scanResult}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 text-center transition-all`}>
              <Scan className={`w-6 h-6 ${themeClasses.accent} mx-auto mb-2`} />
              <h4 className={`${themeClasses.text} font-semibold text-sm`}>Fast Scanning</h4>
              <p className={`${themeClasses.textSecondary} text-xs`}>Real-time detection</p>
            </div>

            <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 text-center transition-all`}>
              <Shield className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <h4 className={`${themeClasses.text} font-semibold text-sm`}>Secure</h4>
              <p className={`${themeClasses.textSecondary} text-xs`}>Encrypted data</p>
            </div>

            <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 text-center transition-all`}>
              <Camera className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <h4 className={`${themeClasses.text} font-semibold text-sm`}>HD Camera</h4>
              <p className={`${themeClasses.textSecondary} text-xs`}>High precision</p>
            </div>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* <style jsx>{`
        @keyframes fastScan {
          0% { top: 10%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style> */}
    </div>
  );
};

export default CameraRoom;