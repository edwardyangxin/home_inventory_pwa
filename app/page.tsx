"use client";

import { useEffect, useState, useRef } from "react";
import { Mic, Square, RefreshCw, Package, Trash2, X, Check, Edit2, ArrowLeft, Send } from "lucide-react";

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
      quantity?: number;
      unit?: string;
      expire_date?: string;
      action?: string;
    }[];
    retrieval?: boolean;
  };
  message: string;
}

interface SearchInventoryResponse {
  success: boolean;
  found: boolean;
  message: string;
  items: InventoryItem[];
}

interface UpdateInventoryResponse {
  success: boolean;
  changes: {
    type: string;
    name: string;
    desc: string;
    expire_date: string;
  }[];
  message: string;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("准备就绪");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [apiResponse, setApiResponse] = useState<ProcessVoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Auto-Update States
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [updateResponse, setUpdateResponse] = useState<UpdateInventoryResponse | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // No longer needed separate editMode state for transcript as it's always editable
  // const [editMode, setEditMode] = useState(false);

  // Search Results State
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'all' | 'search'>('all');

  // Inventory State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New State for Edit Modal
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef(""); 
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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
        resetFlowState();
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
        if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, []);

  const resetFlowState = () => {
      setApiResponse(null);
      setUpdateResponse(null);
      setIsCancelled(false);
      setCountdown(null);
      setSearchResults([]); 
      setSearchMessage(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setDisplayMode('all');
  };

  const fetchInventory = async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch("https://us-central1-home-inventory-483623.cloudfunctions.net/previewSheetData");
      if (!res.ok) throw new Error("Fetch failed");
      const data: InventoryItem[] = await res.json();
      setInventory(data);
    } catch (e) {
      console.error("Failed to fetch inventory", e);
    } finally {
      setLoadingInventory(false);
    }
  };

  const deleteItem = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!confirm(`确定要删除 "${name}" 吗?`)) return;

    setDeletingId(id);
    try {
      const res = await fetch("https://us-central1-home-inventory-483623.cloudfunctions.net/deleteInventoryItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Delete failed");
      
      setInventory(prev => prev.filter(item => item.id !== id));
      setSearchResults(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      console.error("Failed to delete item", e);
      alert("删除失败，请重试");
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (item: InventoryItem) => {
      setEditingItem({ ...item }); 
  };

  const handleEditChange = (field: keyof InventoryItem, value: any) => {
      if (!editingItem) return;
      setEditingItem({ ...editingItem, [field]: value });
  };

  const saveEdit = async () => {
      if (!editingItem) return;
      setIsSavingEdit(true);
      try {
          const payload = {
            id: editingItem.id,
            name: editingItem.name,
            quantity: Number(editingItem.quantity),
            unit: editingItem.unit,
            category: editingItem.category,
            location: editingItem.location,
            expire_date: editingItem.expireDate 
          };

          const res = await fetch("https://us-central1-home-inventory-483623.cloudfunctions.net/editInventoryItem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) throw new Error("Update failed");

          const responseData = await res.json();
          const updatedItem = responseData.item;
          
          setInventory(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));
          setSearchResults(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));
          
          setEditingItem(null); 
          setStatus(`已更新 "${editingItem.name}"`);
      } catch (e) {
          console.error("Failed to update item", e);
          alert("更新失败，请重试");
      } finally {
          setIsSavingEdit(false);
      }
  };

  const startRecording = () => {
    setTranscript("");
    resetFlowState();
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
      if (!text || text.trim().length === 0) return;

      setStatus("正在解析...");
      setIsProcessing(true);
      setUpdateResponse(null); 
      setIsCancelled(false);
      setCountdown(null);
      setSearchResults([]);
      setSearchMessage(null);

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

          if (data.success) {
              if (data.data.retrieval) {
                  searchInventory(data.data.items);
              } else {
                  startAutoUpdateTimer(data);
              }
          }
      } catch (e) {
          setStatus("解析失败");
          setError("无法连接到解析服务");
          console.error(e);
      } finally {
          setIsProcessing(false);
      }
  };

  const searchInventory = async (items: any[]) => {
      setStatus("正在查询库存...");
      setIsSearching(true);
      try {
          const res = await fetch("https://us-central1-home-inventory-483623.cloudfunctions.net/searchInventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });

          if (!res.ok) throw new Error("Search failed");
          const data: SearchInventoryResponse = await res.json();
          
          if (data.success) {
              setSearchResults(data.items || []);
              setSearchMessage(data.message);
              setStatus("查询完成");
              setDisplayMode('search'); 
          } else {
              setSearchMessage(data.message || "未找到相关物品");
              setStatus("未找到");
              setSearchResults([]);
              setDisplayMode('search');
          }

      } catch (e) {
          console.error("Search error", e);
          setError("查询失败");
          setStatus("查询出错");
      } finally {
          setIsSearching(false);
      }
  };

  const startAutoUpdateTimer = (data: ProcessVoiceResponse) => {
      setCountdown(5);
      if (countdownRef.current) clearInterval(countdownRef.current);
      
      let timeLeft = 5;
      countdownRef.current = setInterval(() => {
          timeLeft -= 1;
          setCountdown(timeLeft);
          
          if (timeLeft <= 0) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              setCountdown(null);
              updateInventory(data.data.items);
          }
      }, 1000);
  };

  const cancelAutoUpdate = () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
      setIsCancelled(true);
      setStatus("已取消自动更新，请编辑");
  };

  const updateInventory = async (items: any[]) => {
      setStatus("正在更新库存...");
      setIsUpdating(true);
      try {
          const res = await fetch("https://us-central1-home-inventory-483623.cloudfunctions.net/updateInventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          
          if (!res.ok) throw new Error("Update failed");
          
          const data: UpdateInventoryResponse = await res.json();
          setUpdateResponse(data);
          setStatus("库存更新完成");
          
          // Refresh inventory list
          fetchInventory();
      } catch (e) {
          setStatus("更新失败");
          setError("无法更新库存");
          console.error(e);
      } finally {
          setIsUpdating(false);
      }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    if (dateString.includes('T')) {
        return dateString.split('T')[0];
    }
    return dateString;
  };

  // Determine which list to show
  const currentList = displayMode === 'search' ? searchResults : inventory;

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
            isProcessing || isUpdating || isSearching || isSavingEdit ? "bg-blue-100 text-blue-600 border border-blue-200" : "bg-white text-gray-600 border border-gray-200 shadow-sm"
        }`}>
            {status}
        </div>

        {/* Input Area (Voice + Manual) */}
        <div className="flex-none border border-gray-200 rounded-xl p-3 bg-white min-h-[120px] shadow-sm flex flex-col gap-2 relative focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-shadow">
            <textarea 
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="点击麦克风说话，或直接在此输入..."
                className="w-full flex-1 resize-none outline-none text-base text-gray-800 placeholder:text-gray-400 bg-transparent"
                disabled={isProcessing || isUpdating}
            />
            
            <div className="flex justify-end items-center gap-2">
                {transcript.length > 0 && !isRecording && !isProcessing && (
                    <button 
                        onClick={() => processText(transcript)}
                        className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-all animate-in zoom-in shadow-md"
                        title="发送"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
        
        {/* API Response & Countdown Area */}
        {apiResponse && !updateResponse && !isSearching && (
            <div className={`border rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2 ${apiResponse.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${apiResponse.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            {apiResponse.success ? 'Parsed' : 'Error'}
                        </span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-green-700">
                            解析结果
                        </h3>
                    </div>
                </div>
                <p className="text-green-800 text-sm leading-relaxed mb-3">
                    {apiResponse.message}
                </p>
                
                {/* Countdown & Cancel - Only show if it's NOT a retrieval and update is pending */}
                {countdown !== null && (
                    <div className="flex items-center justify-between bg-white/60 p-2 rounded border border-green-100">
                        <span className="text-xs text-green-800 font-medium animate-pulse">
                            自动更新: {countdown}s...
                        </span>
                        <button 
                            onClick={cancelAutoUpdate}
                            className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-red-200 transition-colors"
                        >
                            取消并编辑
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Update Response Area */}
        {updateResponse && (
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Updated</span>
                    <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">库存更新</h3>
                </div>
                <p className="text-blue-900 text-sm">{updateResponse.message}</p>
                {updateResponse.changes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                        {updateResponse.changes.map((change, idx) => (
                            <li key={idx} className="text-xs text-blue-700 bg-white/50 p-1.5 rounded flex justify-between">
                                <span>{change.name}</span>
                                <span className="font-medium">{change.desc}</span>
                            </li>
                        ))}
                    </ul>
                )}
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
                    disabled={isProcessing || isUpdating || (countdown !== null)}
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
              <Package className="w-5 h-5" /> 
              {displayMode === 'search' ? '查询结果' : '当前库存'}
            </h2>
            
            <div className="flex items-center gap-2">
                {displayMode === 'search' && (
                    <button 
                        onClick={() => {
                            setDisplayMode('all');
                            setSearchResults([]);
                            setSearchMessage(null);
                        }}
                        className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                        <ArrowLeft className="w-3 h-3" /> 返回全部
                    </button>
                )}
                
                <button 
                  onClick={fetchInventory} 
                  disabled={loadingInventory}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                  title="刷新库存"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-600 ${loadingInventory ? 'animate-spin' : ''}`} />
                </button>
            </div>
          </div>

          {displayMode === 'search' && searchMessage && (
              <div className="bg-purple-50 text-purple-800 text-sm p-2 rounded-lg border border-purple-100">
                  {searchMessage}
              </div>
          )}

          <div className="grid gap-3">
            {loadingInventory && inventory.length === 0 ? (
               <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
            ) : currentList.length > 0 ? (
              currentList.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => openEditModal(item)}
                  className={`bg-white p-3 rounded-lg border shadow-sm flex justify-between items-center group cursor-pointer transition-colors active:bg-gray-50 ${displayMode === 'search' ? 'border-purple-200 ring-1 ring-purple-100' : 'border-gray-100'}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                        {item.name}
                        <Edit2 className="w-3 h-3 text-gray-300" />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.category} · {item.location} · 📅 {formatDate(item.expireDate)}
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="text-lg font-bold text-gray-800">
                      {item.quantity} <span className="text-xs font-normal text-gray-500">{item.unit}</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => deleteItem(item.id, item.name, e)}
                    disabled={deletingId === item.id}
                    className="p-3 -mr-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="删除"
                  >
                    {deletingId === item.id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                  {displayMode === 'search' ? '未找到相关物品' : '暂无库存数据'}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-10">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-lg font-bold text-gray-900">✏️ 编辑物品</h3>
                    <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">名称</label>
                        <input 
                            type="text" 
                            value={editingItem.name} 
                            onChange={(e) => handleEditChange('name', e.target.value)}
                            className="w-full text-lg p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">数量</label>
                            <input 
                                type="number" 
                                value={editingItem.quantity} 
                                onChange={(e) => handleEditChange('quantity', e.target.value)}
                                className="w-full text-lg p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">单位</label>
                            <input 
                                type="text" 
                                value={editingItem.unit} 
                                onChange={(e) => handleEditChange('unit', e.target.value)}
                                className="w-full text-lg p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">过期时间</label>
                        <input 
                            type="date" 
                            value={formatDate(editingItem.expireDate)} 
                            onChange={(e) => handleEditChange('expireDate', e.target.value)}
                            className="w-full text-lg p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">分类</label>
                            <input 
                                type="text" 
                                value={editingItem.category} 
                                onChange={(e) => handleEditChange('category', e.target.value)}
                                className="w-full text-base p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                         <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">位置</label>
                            <input 
                                type="text" 
                                value={editingItem.location} 
                                onChange={(e) => handleEditChange('location', e.target.value)}
                                className="w-full text-base p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-4 pt-2 border-t">
                    <button 
                        onClick={() => setEditingItem(null)}
                        className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={saveEdit}
                        disabled={isSavingEdit}
                        className="flex-1 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex justify-center items-center gap-2"
                    >
                        {isSavingEdit ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" /> 保存中
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" /> 保存
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
      
      <footer className="text-[10px] text-gray-400 text-center pb-2">
        PWA v1.0 · "Over" to stop · 30s timeout
      </footer>
    </div>
  );
}