import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const QR_READER_ID = "qr-reader";
const healthIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export default function QRScanner({ onScan }) {
  const [error, setError] = useState("");
  const [mode, setMode] = useState("stopped");
  const [selectedImage, setSelectedImage] = useState(null);
  const scannerRef = useRef(null);
  const releasePromiseRef = useRef(null);
  const onScanRef = useRef(onScan);
  const scanGuardRef = useRef(false);
  const startGuardRef = useRef(false);
  const startGenerationRef = useRef(0);
  const scannerStartPromiseRef = useRef(null);
  const mountedRef = useRef(false);

  const releaseScanner = useCallback(() => {
    if (releasePromiseRef.current) {
      return releasePromiseRef.current;
    }

    const scanner = scannerRef.current;

    if (!scanner) {
      return Promise.resolve();
    }

    const cleanup = (async () => {
      let cleanupFailed = false;

      if (scanner.isScanning) {
        try {
          await scanner.stop();
        } catch (stopError) {
          console.warn("QR scanner stop warning:", stopError);
          cleanupFailed = true;
        }
      }

      try {
        await scanner.clear();
      } catch (clearError) {
        console.warn("QR scanner cleanup warning:", clearError);
        cleanupFailed = true;
      }

      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }

      if (cleanupFailed) {
        throw new Error("The scanner could not be fully stopped. Please close this page before continuing.");
      }
    })();

    releasePromiseRef.current = cleanup;
    void cleanup.finally(() => {
      if (releasePromiseRef.current === cleanup) {
        releasePromiseRef.current = null;
      }
    }).catch(() => {});
    return cleanup;
  }, []);

  const stopCamera = useCallback(async () => {
    startGenerationRef.current += 1;

    try {
      if (scannerStartPromiseRef.current) {
        await scannerStartPromiseRef.current.catch(() => {});
      }
      await releaseScanner();
      if (mountedRef.current) {
        setError("");
      }
    } catch (stopError) {
      if (mountedRef.current) {
        setError(stopError.message);
      }
    } finally {
      if (mountedRef.current) {
        setMode("stopped");
      }
    }
  }, [releaseScanner]);

  const completeScan = useCallback(
    async (decodedText) => {
      const healthId = decodedText.trim();

      if (scanGuardRef.current) {
        return;
      }

      if (!healthIdPattern.test(healthId)) {
        if (mountedRef.current) {
          setError("The QR code does not contain a valid patient Health ID.");
        }
        return false;
      }

      scanGuardRef.current = true;
      if (mountedRef.current) {
        setError("");
        setSelectedImage(null);
      }
      onScanRef.current?.(healthId);
      await stopCamera();
      return true;
    },
    [stopCamera]
  );

  const startCamera = useCallback(async () => {
    if (startGuardRef.current || mode === "camera") {
      return;
    }

    startGuardRef.current = true;
    const startGeneration = ++startGenerationRef.current;
    scanGuardRef.current = false;
    setError("");
    setSelectedImage(null);
    setMode("starting");

    try {
      await releaseScanner();
      const cameras = await Html5Qrcode.getCameras();

      if (!mountedRef.current || startGeneration !== startGenerationRef.current) {
        return;
      }

      if (!cameras?.length) {
        throw new Error("No camera was found on this device.");
      }

      const backCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label || ""));
      const scanner = new Html5Qrcode(QR_READER_ID);
      scannerRef.current = scanner;

      const startPromise = scanner.start(
        backCamera?.id || cameras[0].id,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.333,
          showTorchButtonIfSupported: false,
          disableFlip: false,
        },
        (decodedText) => {
          void completeScan(decodedText);
        },
        () => {
          // Ignore transient decode failures while the camera is searching.
        }
      );
      scannerStartPromiseRef.current = startPromise;
      await startPromise;
      scannerStartPromiseRef.current = null;

      if (mountedRef.current && startGeneration === startGenerationRef.current) {
        setMode("camera");
      } else {
        await releaseScanner();
      }
    } catch (cameraError) {
      console.error("Camera startup error:", cameraError);
      scannerStartPromiseRef.current = null;
      try {
        await releaseScanner();
      } catch (cleanupError) {
        console.warn("Scanner cleanup after startup failure:", cleanupError);
      }

      if (mountedRef.current) {
        setMode("stopped");
        const message = String(cameraError.message || cameraError);
        setError(
          /permission|notallowed|denied/i.test(message)
            ? "Camera permission was denied. Allow camera access in your browser settings, or upload a QR image."
            : /no camera|notfound|device not found/i.test(message)
              ? "No camera is available on this device. Upload a QR image instead."
              : "Unable to start the camera. Check browser permissions and try again, or upload a QR image."
        );
      }
    } finally {
      startGuardRef.current = false;
    }
  }, [completeScan, mode, releaseScanner]);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      startGenerationRef.current += 1;
      void (async () => {
        if (scannerStartPromiseRef.current) {
          await scannerStartPromiseRef.current.catch(() => {});
        }
        await releaseScanner();
      })().catch((cleanupError) => {
        console.warn("Scanner cleanup on close:", cleanupError);
      });
    };
  }, [releaseScanner]);

  function handleImageSelection(event) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedImage(null);
      return;
    }

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      setSelectedImage(null);
      setError("Please choose a PNG, JPG, or JPEG image.");
      event.target.value = "";
      return;
    }

    setSelectedImage(file);
    setError("");
  }

  async function handleImageScan() {
    if (!selectedImage) {
      setError("Choose an image containing a QR code first.");
      return;
    }

    scanGuardRef.current = false;
    setMode("image");
    setError("");

    try {
      await releaseScanner();
      const scanner = new Html5Qrcode(QR_READER_ID);
      scannerRef.current = scanner;
      const decodedText = await scanner.scanFile(selectedImage, false);
      const accepted = await completeScan(decodedText);

      if (!accepted) {
        await releaseScanner();
        if (mountedRef.current) {
          setMode("stopped");
        }
      }
    } catch (scanError) {
      console.warn("QR image scan failed:", scanError);
      try {
        await releaseScanner();
      } catch (cleanupError) {
        console.warn("Image scanner cleanup warning:", cleanupError);
      }

      if (mountedRef.current) {
        setMode("stopped");
        setError("No readable Health ID QR code was found. Choose another image and try again.");
      }
    }
  }

  return (
    <div className="qr-scanner">
      <p>Scan a patient QR code using the camera or an uploaded image.</p>

      <div className="qr-reader-shell">
        <div
          id={QR_READER_ID}
          className={`qr-reader-container ${
            mode === "camera" || mode === "starting" || mode === "image" ? "active" : "hidden"
          }`}
        />
      </div>

      {mode === "camera" || mode === "starting" ? (
        <div className="qr-scanner-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => void stopCamera()}
          >
            Stop Camera
          </button>
        </div>
      ) : (
        <div className="qr-scanner-controls">
          <div className="qr-scanner-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void startCamera()}
              disabled={mode === "starting" || mode === "image"}
            >
              {mode === "starting" ? "Starting Camera..." : "Start Camera"}
            </button>
          </div>

          <div className="qr-image-upload">
            <label htmlFor="patient-record-qr-image-input" className="upload-label">
              Upload Image to Scan QR
            </label>
            <input
              id="patient-record-qr-image-input"
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={handleImageSelection}
              disabled={mode === "starting" || mode === "image"}
            />
            {selectedImage && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => void handleImageScan()}
                disabled={mode === "starting" || mode === "image"}
              >
                {mode === "image" ? "Scanning Image..." : "Scan Image"}
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p role="alert" className="error-message">{error}</p>}
    </div>
  );
}
