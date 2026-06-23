"use client";

import { useState, useRef, useEffect } from "react";
import { X, Camera, Upload, Loader2, CheckCircle, AlertCircle, RefreshCw, Pencil, Search } from "lucide-react";

interface ProductAnalysis {
  searchKeyword: string;
  productName: string;
  color?: { main: string; hex: string; surface: string };
  capacity?: string | null;
  dimensions?: string | null;
  material?: { main: string; details: string };
  brand?: { text: string | null; type: string; position: string } | null;
  features?: string[];
  quality?: string;
  market?: string;
  confidence?: string;
}

interface ImageSearchModalProps {
  onClose: () => void;
  onIdentified: (productName: string) => void;
}

type Step = "choose" | "camera" | "preview" | "identifying" | "analysis" | "success" | "unrecognized" | "error";

export function ImageSearchModal({ onClose, onIdentified }: ImageSearchModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [identified, setIdentified] = useState<string>("");
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [editKeyword, setEditKeyword] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualInput, setManualInput] = useState<string>("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (step !== "camera") stopCamera();
  }, [step]);

  useEffect(() => { return () => stopCamera(); }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setErrorMsg("无法开启摄像头，请确认浏览器已授权使用摄像头");
      setStep("error");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedFile(file);
      stopCamera();
      setStep("preview");
    }, "image/jpeg", 0.85);
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("请选择图片文件（JPG、PNG 等）");
      setStep("error");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
    setStep("preview");
  };

  const handleIdentify = async () => {
    setStep("identifying");
    try {
      if (!selectedFile) throw new Error("找不到图片，请重新选择");
      const base64 = await fileToBase64(selectedFile);
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
      });
      const data = await res.json();
      if (res.status === 422 || (res.ok && !data.productName)) { setStep("unrecognized"); return; }
      if (!res.ok) throw new Error(data.error || "识别失败");
      setIdentified(data.productName);
      if (data.analysis) {
        setAnalysis(data.analysis);
        setEditKeyword(data.productName);
        setStep("analysis");
      } else {
        setStep("success");
        setTimeout(() => { onIdentified(data.productName); onClose(); }, 1500);
      }
    } catch (err) {
      setErrorMsg(`错误：${err instanceof Error ? err.message : String(err)}`);
      setStep("error");
    }
  };

  const handleSearch = () => {
    const keyword = editKeyword.trim() || identified;
    onIdentified(keyword);
    onClose();
  };

  const handleManualSearch = () => {
    if (!manualInput.trim()) return;
    onIdentified(manualInput.trim());
    onClose();
  };

  const handleReset = () => {
    setPreviewUrl(""); setSelectedFile(null); setIdentified("");
    setAnalysis(null); setEditKeyword(""); setErrorMsg(""); setManualInput("");
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    setStep("choose");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800 text-base">拍照识别产品</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">

          {/* Step: choose */}
          {step === "choose" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">选择图片来源，AI 会分析产品详情</p>
              <input ref={uploadInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])} />
              <button onClick={startCamera}
                className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-all group">
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center transition-colors">
                  <Camera className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-800 text-sm">拍照</p>
                  <p className="text-xs text-slate-500 mt-0.5">直接开启摄像头拍摄</p>
                </div>
              </button>
              <button onClick={() => uploadInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50 rounded-xl transition-all group">
                <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-200 rounded-xl flex items-center justify-center transition-colors">
                  <Upload className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-800 text-sm">上传图片</p>
                  <p className="text-xs text-slate-500 mt-0.5">从相册或电脑选择图片</p>
                </div>
              </button>
            </div>
          )}

          {/* Step: camera */}
          {step === "camera" && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                  <button onClick={capturePhoto}
                    className="w-14 h-14 bg-white rounded-full border-4 border-slate-300 hover:scale-105 transition-transform shadow-lg flex items-center justify-center">
                    <div className="w-10 h-10 bg-white rounded-full border-2 border-slate-400" />
                  </button>
                </div>
              </div>
              <button onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <RefreshCw className="w-4 h-4" />取消
              </button>
            </div>
          )}

          {/* Step: preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden bg-slate-100 max-h-64 flex items-center justify-center">
                <img src={previewUrl} alt="预览" className="w-full h-full object-contain max-h-64" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <RefreshCw className="w-4 h-4" />重新选择
                </button>
                <button onClick={handleIdentify}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  识别产品
                </button>
              </div>
            </div>
          )}

          {/* Step: identifying */}
          {step === "identifying" && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-800">AI 正在分析产品…</p>
                <p className="text-sm text-slate-500 mt-1">识别颜色、材质、品牌等详情</p>
              </div>
            </div>
          )}

          {/* Step: analysis */}
          {step === "analysis" && analysis && (
            <div className="space-y-4">
              {/* Preview thumbnail */}
              {previewUrl && (
                <div className="flex gap-3 items-start">
                  <img src={previewUrl} alt="产品" className="w-20 h-20 object-cover rounded-xl border border-slate-200 shrink-0" />
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-medium text-green-600">识别完成</span>
                      {analysis.confidence && <span className="text-xs text-slate-400">· 可信度 {analysis.confidence}</span>}
                    </div>
                    <p className="font-bold text-slate-800 text-base leading-snug">{analysis.productName}</p>
                    {analysis.market && <p className="text-xs text-slate-500 mt-0.5">{analysis.market}</p>}
                  </div>
                </div>
              )}

              {/* Analysis details */}
              <div className="bg-slate-50 rounded-xl divide-y divide-slate-100 text-sm border border-slate-100">
                {analysis.color && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-slate-400 w-14 shrink-0">颜色</span>
                    <div className="flex items-center gap-2 flex-1">
                      {analysis.color.hex && (
                        <span className="w-4 h-4 rounded-full border border-slate-200 shrink-0"
                          style={{ backgroundColor: analysis.color.hex }} />
                      )}
                      <span className="text-slate-700">{analysis.color.main}</span>
                      {analysis.color.hex && <span className="text-slate-400 text-xs">{analysis.color.hex}</span>}
                      {analysis.color.surface && <span className="text-slate-400 text-xs">· {analysis.color.surface}</span>}
                    </div>
                  </div>
                )}
                {analysis.material && (
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-slate-400 w-14 shrink-0">材质</span>
                    <div className="flex-1">
                      <span className="text-slate-700">{analysis.material.main}</span>
                      {analysis.material.details && <p className="text-xs text-slate-400 mt-0.5">{analysis.material.details}</p>}
                    </div>
                  </div>
                )}
                {analysis.capacity && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-slate-400 w-14 shrink-0">容量</span>
                    <span className="text-slate-700 flex-1">{analysis.capacity}</span>
                  </div>
                )}
                {analysis.dimensions && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-slate-400 w-14 shrink-0">尺寸</span>
                    <span className="text-slate-700 flex-1">{analysis.dimensions}</span>
                  </div>
                )}
                {analysis.brand?.text && (
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-slate-400 w-14 shrink-0">品牌</span>
                    <div className="flex-1">
                      <span className="text-slate-700">{analysis.brand.text}</span>
                      <span className="ml-1.5 text-xs text-slate-400">
                        ({analysis.brand.type === "decorative" ? "装饰印刷" : "制造商品牌"})
                      </span>
                      {analysis.brand.position && <p className="text-xs text-slate-400 mt-0.5">{analysis.brand.position}</p>}
                    </div>
                  </div>
                )}
                {analysis.features && analysis.features.length > 0 && (
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-slate-400 w-14 shrink-0">特征</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {analysis.features.map((f, i) => (
                        <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-100">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.quality && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-slate-400 w-14 shrink-0">质量</span>
                    <span className="text-slate-700 flex-1">{analysis.quality}</span>
                  </div>
                )}
              </div>

              {/* Editable search keyword */}
              <div>
                <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Pencil className="w-3 h-3" />搜索词（可修改）
                </p>
                <input type="text" value={editKeyword} onChange={(e) => setEditKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full px-3 py-2.5 border-2 border-blue-200 focus:border-blue-500 rounded-xl text-sm text-slate-800 focus:outline-none bg-white" />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button onClick={handleReset}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <RefreshCw className="w-4 h-4" />重拍
                </button>
                <button onClick={handleSearch}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  <Search className="w-4 h-4" />开始搜索
                </button>
              </div>
            </div>
          )}

          {/* Step: success */}
          {step === "success" && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">识别成功！正在搜索</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{identified}</p>
              </div>
            </div>
          )}

          {/* Step: unrecognized */}
          {step === "unrecognized" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-amber-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800">无法辨认这个产品</p>
                  <p className="text-sm text-slate-500 mt-1">图片可能太模糊、光线不足，或者是比较少见的品类</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold mb-1">拍摄小贴士：</p>
                <p>· 确保产品清晰对焦，避免模糊</p>
                <p>· 光线充足，不要逆光</p>
                <p>· 让产品占满画面大部分</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />或者直接输入产品名称来搜索：
                </p>
                <div className="flex gap-2">
                  <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                    placeholder="例如：竹砧板"
                    className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleManualSearch} disabled={!manualInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold px-4 rounded-xl transition-colors">
                    搜索
                  </button>
                </div>
              </div>
              <button onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <RefreshCw className="w-4 h-4" />重新拍照
              </button>
            </div>
          )}

          {/* Step: error */}
          {step === "error" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800">出了点问题</p>
                  <p className="text-sm text-slate-500 mt-1">{errorMsg}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />先用文字搜索：
                </p>
                <div className="flex gap-2">
                  <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                    placeholder="输入产品名称"
                    className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleManualSearch} disabled={!manualInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold px-4 rounded-xl transition-colors">
                    搜索
                  </button>
                </div>
              </div>
              <button onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <RefreshCw className="w-4 h-4" />重试
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
        else { width = Math.round((width / height) * MAX); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片读取失败")); };
    img.src = url;
  });
}
