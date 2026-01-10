"use client";

import { useEffect, useState, useRef } from "react";
import { Mic, Square } from "lucide-react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("准备就绪");
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiResponse, setApiResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef(""); // To access latest transcript in callbacks

  useEffect(() => {
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
        setApiResponse("");
        transcriptRef.current = ""; 
        setTranscript("");

        // 30s timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          stopRecording("超时");
        }, 30000);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        // Slight delay to ensure all state updates are processed? 
        // No, standard JS flow.
        const finalText = transcriptRef.current;
        
        // Only process if we have text and weren't already processing (avoid double submit if logic overlaps)
        // But onend is the definitive end.
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

        // Check for "over"
        if (currentFullTranscript.toLowerCase().includes("over")) {
          // Trigger stop
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

  const startRecording = () => {
    setTranscript("");
    setApiResponse("");
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

  const mockPostToAPI = (text: string): Promise<string> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`成功接收文本，字符长度: ${text.length}`);
      }, 1500);
    });
  };

  const processText = async (text: string) => {
      setStatus("正在上传到 API...");
      setIsProcessing(true);
      try {
          const response = await mockPostToAPI(text);
          setApiResponse(response);
          setStatus("处理完成");
      } catch (e) {
          setStatus("上传失败");
          console.error(e);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)] max-w-md mx-auto">
      <header className="w-full text-center space-y-2">
        <h1 className="text-2xl font-bold">🎙 语音助手</h1>
        <p className="text-sm text-gray-500">本地 STT + Mock API (PWA)</p>
      </header>

      <main className="flex-1 flex flex-col w-full gap-6">
        {/* Status Display */}
        <div className={`text-center py-2 px-4 rounded-full text-sm font-medium ${
            isRecording ? "bg-red-100 text-red-600 animate-pulse" : 
            isProcessing ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
        }`}>
            {status}
        </div>

        {/* Transcript Area */}
        <div className="flex-1 border border-gray-200 rounded-xl p-4 bg-gray-50 min-h-[200px] overflow-y-auto shadow-inner">
            {transcript ? (
                <p className="text-lg text-gray-800 whitespace-pre-wrap">{transcript}</p>
            ) : (
                <p className="text-gray-400 italic">点击开始说话...</p>
            )}
        </div>
        
        {/* API Response Area */}
        {apiResponse && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">API 响应</h3>
                <p className="text-green-800">{apiResponse}</p>
            </div>
        )}

        {/* Error Display */}
        {error && (
             <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                {error}
             </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4 mt-auto">
            {!isRecording ? (
                <button 
                    onClick={startRecording}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    <Mic className="w-5 h-5" />
                    开始录音
                </button>
            ) : (
                <button 
                    onClick={() => stopRecording("手动停止")}
                    className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-full hover:bg-red-700 active:scale-95 transition-all shadow-lg animate-pulse"
                >
                    <Square className="w-5 h-5 fill-current" />
                    结束录音
                </button>
            )}
        </div>
      </main>
      
      <footer className="text-xs text-gray-400 text-center">
        支持: "Over" 自动结束, 30s 超时
      </footer>
    </div>
  );
}