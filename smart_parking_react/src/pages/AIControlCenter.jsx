import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

// ── Metric card ────────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, color = 'text-primary', pulse = false }) {
  return (
    <div className="bg-surface rounded-xl border border-outline-variant p-md shadow-sm flex flex-col gap-xs">
      <div className="flex items-center gap-xs">
        <span className={`material-symbols-outlined ${color} text-[22px]`}>{icon}</span>
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{label}</span>
        {pulse && <span className="ml-auto w-2 h-2 rounded-full bg-secondary animate-pulse" />}
      </div>
      <p className="font-display text-[28px] leading-none text-on-surface">{value ?? '—'}</p>
      {sub && <p className="text-body-md text-on-surface-variant">{sub}</p>}
    </div>
  );
}

// ── Detection overlay canvas ───────────────────────────────────────────────────
function DetectionCanvas({ imageUrl, detections, slots }) {
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || !imageUrl) return;

    const draw = () => {
      canvas.width  = img.naturalWidth  || img.offsetWidth;
      canvas.height = img.naturalHeight || img.offsetHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw vehicle detections
      (detections || []).forEach(d => {
        const [x1, y1, x2, y2] = d.bbox;
        ctx.strokeStyle = '#3983ff';
        ctx.lineWidth   = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillStyle = 'rgba(57,131,255,0.15)';
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillStyle = '#3983ff';
        ctx.font = 'bold 12px Inter';
        ctx.fillText(`${d.class} ${Math.round((d.confidence || 0) * 100)}%`, x1 + 4, y1 - 4);
      });

      // Draw slot status overlays
      Object.entries(slots || {}).forEach(([slotId, status]) => {
        ctx.fillStyle = status === 'Occupied'
          ? 'rgba(228,69,69,0.25)'
          : 'rgba(6,147,86,0.25)';
        ctx.font = 'bold 11px Inter';
        ctx.fillStyle = status === 'Occupied' ? '#e44545' : '#069356';
        ctx.fillText(slotId, 10, 14);
      });
    };

    if (img.complete) draw();
    else img.onload = draw;
  }, [imageUrl, detections, slots]);

  if (!imageUrl) return null;

  return (
    <div className="relative w-full">
      <img ref={imgRef} src={imageUrl} alt="Parking frame" className="w-full rounded-lg" />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
    </div>
  );
}

// ── Plate result row ───────────────────────────────────────────────────────────
function PlateRow({ plate }) {
  const authorized = plate.authorized;
  return (
    <div className={`flex items-center gap-sm p-sm rounded-lg border ${authorized ? 'border-secondary/40 bg-secondary/5' : 'border-error/40 bg-error/5'}`}>
      <span className={`material-symbols-outlined text-[20px] ${authorized ? 'text-secondary' : 'text-error'}`}>
        {authorized ? 'check_circle' : 'warning'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-on-surface font-body-lg">{plate.plate_text || '—'}</p>
        <p className="text-body-md text-on-surface-variant truncate">
          {authorized ? `Authorized · ${plate.vehicle?.make || ''} ${plate.vehicle?.model || ''}` : 'Unregistered Plate'}
        </p>
      </div>
      <span className={`text-label-md font-label-md px-sm py-1 rounded-full ${authorized ? 'bg-secondary/20 text-secondary' : 'bg-error/20 text-error'}`}>
        {Math.round((plate.plate_confidence || 0) * 100)}%
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AIControlCenter() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const [aiStatus,    setAiStatus]    = useState(null);      // {online, ...}
  const [aiMetrics,   setAiMetrics]   = useState(null);
  const [activeTab,   setActiveTab]   = useState('occupancy'); // occupancy | plate | log
  const [uploading,   setUploading]   = useState(false);
  const [imageUrl,    setImageUrl]    = useState(null);
  const [detections,  setDetections]  = useState([]);
  const [slotResults, setSlotResults] = useState({});
  const [occupancySummary, setOccupancySummary] = useState(null);
  const [plateResults,     setPlateResults]     = useState([]);
  const [inferenceLog,     setInferenceLog]     = useState([]);

  // ── Fetch AI service status ──────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await authFetch('/api/ai/status');
      const data = await res.json();
      setAiStatus(data);
    } catch { setAiStatus({ online: false }); }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res  = await authFetch('/api/ai/metrics');
      const data = await res.json();
      setAiMetrics(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchMetrics();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, [fetchStatus, fetchMetrics]);

  // ── Real-time: listen to AI socket events ────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onOccupancy = (data) => {
      setSlotResults(data.slots || {});
      setOccupancySummary(data);
      setInferenceLog(prev => [{
        ts: data.timestamp,
        occupied: data.occupied_count,
        total: data.total_slots,
        ms: data.inference_ms,
      }, ...prev.slice(0, 19)]);
    };

    const onPlate = (data) => {
      setPlateResults(prev => [data, ...prev.slice(0, 9)]);
    };

    const onAlert = (data) => {
      toast.error?.(`🚨 AI Alert: ${data.message}`) || console.warn('[AI Alert]', data.message);
    };

    socket.on('ai:occupancy-update', onOccupancy);
    socket.on('ai:plate-detected',   onPlate);
    socket.on('ai:alert',            onAlert);

    return () => {
      socket.off('ai:occupancy-update', onOccupancy);
      socket.off('ai:plate-detected',   onPlate);
      socket.off('ai:alert',            onAlert);
    };
  }, [socket, toast]);

  // ── Upload handlers ──────────────────────────────────────────────────────────
  const handleOccupancyUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUrl(URL.createObjectURL(file));
    setUploading(true);
    setDetections([]);
    setSlotResults({});
    setOccupancySummary(null);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('zone_name', 'north_terminal');

      const res  = await authFetch('/api/ai/analyze-frame', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      setDetections(data.detections || []);
      setSlotResults(data.slots     || {});
      setOccupancySummary(data);
      toast.success?.(`✓ Detected ${data.vehicle_count} vehicles · ${data.occupancy_pct}% occupied`);
    } catch (err) {
      toast.error?.(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePlateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);

      const res  = await authFetch('/api/ai/detect-plate', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Detection failed');

      if (data.plate_text) {
        setPlateResults(prev => [data, ...prev.slice(0, 9)]);
        toast.success?.(`Plate detected: ${data.plate_text}`);
      } else {
        toast.error?.('No plate text recognized');
      }
    } catch (err) {
      toast.error?.(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const runtime = aiMetrics?.runtime || {};
  const evalM   = aiMetrics?.evaluation?.base || {};

  const tabs = [
    { id: 'occupancy', icon: 'local_parking', label: 'Occupancy Detection' },
    { id: 'plate',     icon: 'id_card',       label: 'Plate Recognition' },
    { id: 'metrics',   icon: 'analytics',     label: 'Model Metrics' },
    { id: 'log',       icon: 'history',       label: 'Inference Log' },
  ];

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 w-full bg-surface border-b border-outline-variant shadow-sm z-40 flex items-center justify-between px-lg h-16">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-[24px]">smart_toy</span>
          <h2 className="font-headline-md text-headline-md font-bold text-primary">AI Control Center</h2>
          {/* Service status badge */}
          <span className={`ml-2 inline-flex items-center gap-1 px-sm py-1 rounded-full text-label-md font-label-md ${aiStatus?.online ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${aiStatus?.online ? 'bg-secondary animate-pulse' : 'bg-error'}`} />
            {aiStatus?.online ? 'AI Service Online' : 'AI Service Offline'}
          </span>
        </div>
        <button onClick={() => { fetchStatus(); fetchMetrics(); }}
          className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity shadow-sm cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          <span className="font-label-md text-label-md hidden md:block">Refresh</span>
        </button>
      </header>

      <div className="p-lg space-y-lg max-w-[1440px] mx-auto">

        {/* AI Offline banner */}
        {aiStatus?.online === false && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-md flex items-center gap-sm">
            <span className="material-symbols-outlined text-error text-[24px]">warning</span>
            <div>
              <p className="font-bold text-error">Python AI Service is not running</p>
              <p className="text-body-md text-on-surface-variant">
                Start it with: <code className="bg-surface-container px-sm rounded font-mono text-sm">cd ai-service && uvicorn api:app --port 8000</code>
              </p>
            </div>
          </div>
        )}

        {/* Summary metric strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          <MetricCard icon="speed"         label="Avg Latency"   value={runtime.avg_latency_ms ? `${runtime.avg_latency_ms} ms` : '—'} color="text-primary" />
          <MetricCard icon="query_stats"   label="Total Requests" value={runtime.total_requests ?? '0'} color="text-secondary" />
          <MetricCard icon="target"        label="mAP@0.5"       value={evalM.mAP50 ? `${(evalM.mAP50 * 100).toFixed(1)}%` : '—'} color="text-tertiary" />
          <MetricCard icon="verified"      label="Precision"     value={evalM.precision ? `${(evalM.precision * 100).toFixed(1)}%` : '—'} color="text-primary" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-xs overflow-x-auto custom-scrollbar bg-surface p-sm rounded-xl border border-outline-variant shadow-sm whitespace-nowrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-md py-sm rounded-lg flex items-center gap-xs cursor-pointer transition-colors ${activeTab === t.id ? 'bg-primary-fixed text-on-primary-fixed font-bold' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Occupancy Detection ────────────────────────────────────────── */}
        {activeTab === 'occupancy' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
            {/* Upload panel */}
            <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm space-y-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">Upload Parking Frame</h3>
              <p className="text-body-md text-on-surface-variant">Upload a parking-lot camera image. The AI model detects vehicles and maps them to slot regions.</p>
              <label className={`block w-full border-2 border-dashed border-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <input type="file" accept="image/*" className="hidden" onChange={handleOccupancyUpload} />
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block">upload_file</span>
                <p className="font-bold text-on-surface">{uploading ? 'Analyzing...' : 'Click to upload or drag & drop'}</p>
                <p className="text-body-md text-on-surface-variant mt-1">JPEG / PNG · Any resolution</p>
              </label>

              {imageUrl && (
                <DetectionCanvas imageUrl={imageUrl} detections={detections} slots={slotResults} />
              )}

              {uploading && (
                <div className="flex items-center gap-sm p-sm bg-primary/5 rounded-lg border border-primary/20">
                  <span className="material-symbols-outlined animate-spin text-primary">refresh</span>
                  <span className="text-body-md text-primary font-bold">Running YOLOv8 inference…</span>
                </div>
              )}
            </div>

            {/* Results panel */}
            <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm space-y-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">Slot Occupancy Results</h3>

              {occupancySummary && (
                <div className="grid grid-cols-3 gap-sm mb-md">
                  <div className="bg-error/10 border border-error/20 rounded-lg p-sm text-center">
                    <p className="font-display text-[28px] text-error">{occupancySummary.occupied_count}</p>
                    <p className="text-label-md font-label-md text-on-surface-variant">Occupied</p>
                  </div>
                  <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-sm text-center">
                    <p className="font-display text-[28px] text-secondary">{occupancySummary.available_count}</p>
                    <p className="text-label-md font-label-md text-on-surface-variant">Available</p>
                  </div>
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-sm text-center">
                    <p className="font-display text-[28px] text-primary">{occupancySummary.occupancy_pct}%</p>
                    <p className="text-label-md font-label-md text-on-surface-variant">Occupancy</p>
                  </div>
                </div>
              )}

              {Object.keys(slotResults).length > 0 ? (
                <div className="grid grid-cols-2 gap-sm max-h-[400px] overflow-y-auto custom-scrollbar">
                  {Object.entries(slotResults).map(([slotId, status]) => (
                    <div key={slotId}
                      className={`flex items-center gap-xs p-sm rounded-lg border text-body-md font-bold ${status === 'Occupied' ? 'border-error/40 bg-error/5 text-error' : 'border-secondary/40 bg-secondary/5 text-secondary'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {status === 'Occupied' ? 'directions_car' : 'check_circle'}
                      </span>
                      <span className="font-mono">{slotId}</span>
                      <span className="ml-auto text-label-md">{status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[64px] mb-sm opacity-40">local_parking</span>
                  <p className="font-body-lg">Upload a parking image to see per-slot occupancy</p>
                </div>
              )}

              {occupancySummary && (
                <p className="text-body-md text-on-surface-variant border-t border-outline-variant pt-sm">
                  Inference: <span className="font-bold text-on-surface">{occupancySummary.inference_ms} ms</span>
                  {' · '}Vehicles: <span className="font-bold text-on-surface">{occupancySummary.vehicle_count}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Plate Recognition ─────────────────────────────────────────── */}
        {activeTab === 'plate' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
            <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm space-y-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">License Plate Detection</h3>
              <p className="text-body-md text-on-surface-variant">
                Upload a vehicle image. The AI detects the plate region, preprocesses it, and runs OCR. Result is checked against the Vehicle Registry.
              </p>
              <label className={`block w-full border-2 border-dashed border-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <input type="file" accept="image/*" className="hidden" onChange={handlePlateUpload} />
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block">id_card</span>
                <p className="font-bold text-on-surface">{uploading ? 'Reading plate...' : 'Upload vehicle image'}</p>
                <p className="text-body-md text-on-surface-variant mt-1">YOLOv8 → CLAHE → EasyOCR</p>
              </label>

              <div className="bg-surface-container rounded-lg p-md border border-outline-variant">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">Pipeline</p>
                {['Vehicle Detection', 'Plate Region Crop', 'Perspective Correction', 'CLAHE Enhancement', 'Bilateral Filter', 'EasyOCR', 'Post-processing'].map((step, i) => (
                  <div key={step} className="flex items-center gap-xs py-1">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-body-md text-on-surface">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm space-y-md">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md text-headline-md text-on-surface">Recent Plate Reads</h3>
                {plateResults.length > 0 && (
                  <button onClick={() => setPlateResults([])} className="text-label-md text-on-surface-variant hover:text-error transition-colors cursor-pointer">Clear</button>
                )}
              </div>

              {plateResults.length > 0 ? (
                <div className="space-y-sm max-h-[500px] overflow-y-auto custom-scrollbar">
                  {plateResults.map((p, i) => <PlateRow key={i} plate={p} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[64px] mb-sm opacity-40">id_card</span>
                  <p className="font-body-lg">No plates read yet</p>
                  <p className="text-body-md mt-1">Upload a vehicle image to begin</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Model Metrics ─────────────────────────────────────────────── */}
        {activeTab === 'metrics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
            <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm space-y-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">Evaluation Metrics</h3>
              <p className="text-body-md text-on-surface-variant">
                Populated after running <code className="bg-surface-container px-xs rounded font-mono">python training/evaluate.py</code>
              </p>
              {[
                { label: 'Precision',         value: evalM.precision,  fmt: v => `${(v*100).toFixed(1)}%`, icon: 'target',       color: 'text-primary' },
                { label: 'Recall',            value: evalM.recall,     fmt: v => `${(v*100).toFixed(1)}%`, icon: 'sensors',      color: 'text-secondary' },
                { label: 'F1-Score',          value: evalM.f1,         fmt: v => `${(v*100).toFixed(1)}%`, icon: 'show_chart',   color: 'text-tertiary' },
                { label: 'mAP@0.5',           value: evalM.mAP50,      fmt: v => `${(v*100).toFixed(1)}%`, icon: 'grade',        color: 'text-primary' },
                { label: 'mAP@0.5:0.95',      value: evalM.mAP50_95,   fmt: v => `${(v*100).toFixed(1)}%`, icon: 'stacked_bar_chart', color: 'text-secondary' },
              ].map(({ label, value, fmt, icon, color }) => (
                <div key={label} className="flex items-center justify-between p-sm rounded-lg bg-surface-container-low border border-outline-variant">
                  <div className="flex items-center gap-sm">
                    <span className={`material-symbols-outlined text-[20px] ${color}`}>{icon}</span>
                    <span className="font-body-lg text-on-surface">{label}</span>
                  </div>
                  <span className={`font-bold font-body-lg ${value ? color : 'text-on-surface-variant'}`}>
                    {value ? fmt(value) : 'Run evaluate.py'}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm space-y-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">Runtime Performance</h3>
              {[
                { label: 'Avg Inference Latency', value: runtime.avg_latency_ms ? `${runtime.avg_latency_ms} ms`  : '—', icon: 'speed',        color: 'text-primary' },
                { label: 'Estimated FPS',         value: runtime.avg_latency_ms ? `${(1000/runtime.avg_latency_ms).toFixed(1)}` : '—', icon: 'videocam', color: 'text-secondary' },
                { label: 'Total Requests',        value: runtime.total_requests ?? '0', icon: 'query_stats', color: 'text-tertiary' },
                { label: 'Last Inference',        value: runtime.last_inference_ms ? `${runtime.last_inference_ms} ms` : '—', icon: 'timer', color: 'text-primary' },
                { label: 'Model Version',         value: runtime.model_version ?? 'pretrained-coco', icon: 'model_training', color: 'text-secondary' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="flex items-center justify-between p-sm rounded-lg bg-surface-container-low border border-outline-variant">
                  <div className="flex items-center gap-sm">
                    <span className={`material-symbols-outlined text-[20px] ${color}`}>{icon}</span>
                    <span className="font-body-lg text-on-surface">{label}</span>
                  </div>
                  <span className={`font-bold font-body-lg ${color}`}>{value}</span>
                </div>
              ))}

              <div className="bg-surface-container rounded-lg p-md border border-outline-variant mt-md">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">Quick Commands</p>
                {[
                  ['Train model',    'python training/train.py'],
                  ['Evaluate model', 'python training/evaluate.py'],
                  ['Robustness test','python evaluation/robustness.py'],
                  ['Start API',      'uvicorn api:app --port 8000'],
                ].map(([label, cmd]) => (
                  <div key={cmd} className="py-1">
                    <span className="text-body-md text-on-surface-variant">{label}: </span>
                    <code className="text-sm font-mono bg-surface px-xs rounded text-primary">{cmd}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Inference Log ─────────────────────────────────────────────── */}
        {activeTab === 'log' && (
          <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-md border-b border-outline-variant flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">history</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Inference Log</h3>
              <span className="ml-auto text-body-md text-on-surface-variant">Live via Socket.IO · last {inferenceLog.length} events</span>
            </div>
            {inferenceLog.length > 0 ? (
              <div className="divide-y divide-outline-variant">
                {inferenceLog.map((entry, i) => (
                  <div key={i} className="flex items-center gap-md px-md py-sm text-body-md hover:bg-surface-container-low transition-colors">
                    <span className="font-mono text-on-surface-variant text-xs w-36 shrink-0">
                      {entry.ts ? new Date(entry.ts).toLocaleTimeString() : '—'}
                    </span>
                    <span className="text-on-surface">Occupied: <b className="text-error">{entry.occupied}</b> / {entry.total}</span>
                    <span className="ml-auto text-on-surface-variant">{entry.ms} ms</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[64px] mb-sm opacity-40">history</span>
                <p className="font-body-lg">No inference events yet</p>
                <p className="text-body-md mt-1">Upload a parking frame or wait for a live Socket.IO event</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
