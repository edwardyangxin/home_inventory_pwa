"use client";

import { useEffect, useState, useRef } from "react";
import { Mic, Square, RefreshCw, Package } from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  unit: string;
  expireDate: string;
  status: string;
}

interface ProcessVoiceResponse {
  success: boolean;
  data: {
    items: {
      name: string;
      quantity: number;
      unit: string;
      expire_date: string;
    }[];
  };
  message: string;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("准备就绪");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Changed apiResponse to store the full object or null
  const [apiResponse, setApiResponse] = useState<ProcessVoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Inventory State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef(""); 

  useEffect(() => {
    // Initial fetch of inventory
    fetchInventory();

    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setError("当前浏览器不支持 Web Speech API");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsRecording(true);
        setStatus("正在录音... (30秒后自动结束)");
        setError(null);
        setApiResponse(null); // Clear previous response
        transcriptRef.current = ""; 
        setTranscript("");

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          stopRecording("超时");
        }, 30000);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        const finalText = transcriptRef.current;
        
        if (finalText && finalText.trim().length > 0) {
             processText(finalText);
        } else {
             setStatus("录音结束 (无内容)");
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Error:", event.error);
        if (event.error === 'no-speech') {
            setStatus("未检测到语音");
        } else {
            setError(`发生错误: ${event.error}`);
        }
      };

      recognition.onresult = (event: any) => {
        const currentFullTranscript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join("");

        setTranscript(currentFullTranscript);
        transcriptRef.current = currentFullTranscript;

        if (currentFullTranscript.toLowerCase().includes("over")) {
          if (recognitionRef.current) {
              recognitionRef.current.stop();
          }
          setStatus("已停止 (检测到 'over')");
        }
      };
    }
    
    return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (recognitionRef.current) recognitionRef.current.stop();
    }
  }, []);

  const fetchInventory = async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch("https://us-central1-home-inventory-483623.cloudfunctions.net/previewSheetData");
      if (!res.ok) throw new Error("Fetch failed");
      const data: InventoryItem[] = await res.json();
      setInventory(data);
    } catch (e) {
      console.error("Failed to fetch inventory", e);
      // Optional: don't block main UI with inventory error, just log it or show small badge
    } finally {
      setLoadingInventory(false);
    }
  };

  const startRecording = () => {
    setTranscript("");
    setApiResponse(null);
    setError(null);
    try {
        recognitionRef.current?.start();
    } catch (e) {
        console.error(e);
        setError("无法启动录音 (可能正在进行中)");
    }
  };

  const stopRecording = (reason?: string) => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
    if (reason) setStatus(`已停止 (${reason})`);
  };

  const processText = async (text: string) => {
      setStatus("正在解析...");
      setIsProcessing(true);
      try {
          const res = await fetch("https://us-central1-home-inventory-483623.cloudfunctions.net/processVoiceInput", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          
          if (!res.ok) throw new Error("API call failed");
          
          const data: ProcessVoiceResponse = await res.json();
          setApiResponse(data);
          setStatus("解析完成");
      } catch (e) {
          setStatus("解析失败");
          setError("无法连接到解析服务");
          console.error(e);
      } finally {
          setIsProcessing(false);
      }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("zh-CN");
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4 pb-20 gap-6 font-[family-name:var(--font-geist-sans)] max-w-lg mx-auto bg-gray-50">
      <header className="w-full text-center space-y-2 mt-4">
        <h1 className="text-2xl font-bold text-gray-900">🎙 家庭库存助手</h1>
        <p className="text-xs text-gray-500">语音录入 & 库存管理</p>
      </header>

      <main className="flex-1 flex flex-col w-full gap-4">
        {/* Status Display */}
        <div className={`text-center py-2 px-4 rounded-full text-xs font-medium transition-colors ${
            isRecording ? "bg-red-100 text-red-600 animate-pulse border border-red-200" : 
            isProcessing ? "bg-blue-100 text-blue-600 border border-blue-200" : "bg-white text-gray-600 border border-gray-200 shadow-sm"
        }`}>
            {status}
        </div>

        {/* Transcript Area */}
        <div className="flex-none border border-gray-200 rounded-xl p-4 bg-white min-h-[120px] max-h-[200px] overflow-y-auto shadow-sm">
            {transcript ? (
                <p className="text-base text-gray-800 whitespace-pre-wrap">{transcript}</p>
            ) : (
                <p className="text-gray-400 italic text-sm text-center mt-8">点击麦克风开始说话...</p>
            )}
        </div>
        
        {/* API Response Area */}
        {apiResponse && (
            <div className={`border rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2 ${apiResponse.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${apiResponse.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {apiResponse.success ? 'SUCCESS' : 'ERROR'}
                    </span>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${apiResponse.success ? 'text-green-700' : 'text-red-700'}`}>
                        AI 解析结果
                    </h3>
                </div>
                <p className={`${apiResponse.success ? 'text-green-800' : 'text-red-800'} text-sm leading-relaxed`}>
                    {apiResponse.message}
                </p>
            </div>
        )}

        {/* Error Display */}
        {error && (
             <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                {error}
             </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4 py-2">
            {!isRecording ? (
                <button 
                    onClick={startRecording}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-lg font-medium"
                >
                    <Mic className="w-6 h-6" />
                    开始录音
                </button>
            ) : (
                <button 
                    onClick={() => stopRecording("手动停止")}
                    className="flex items-center gap-2 bg-red-600 text-white px-8 py-4 rounded-full hover:bg-red-700 active:scale-95 transition-all shadow-lg animate-pulse text-lg font-medium"
                >
                    <Square className="w-6 h-6 fill-current" />
                    结束录音
                </button>
            )}
        </div>

        <hr className="border-gray-200 my-2" />

        {/* Inventory Section */}
        <section className="w-full space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Package className="w-5 h-5" /> 当前库存
            </h2>
            <button 
              onClick={fetchInventory} 
              disabled={loadingInventory}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
              title="刷新库存"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${loadingInventory ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid gap-3">
            {loadingInventory && inventory.length === 0 ? (
               <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
            ) : inventory.length > 0 ? (
              inventory.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.category} · {item.location} · 📅 {formatDate(item.expireDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-800">
                      {item.quantity} <span className="text-xs font-normal text-gray-500">{item.unit}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">暂无库存数据</div>
            )}
          </div>
        </section>

      </main>
      
      <footer className="text-[10px] text-gray-400 text-center pb-2">
        PWA v1.0 · "Over" to stop · 30s timeout
      </footer>
    </div>
  );
}
