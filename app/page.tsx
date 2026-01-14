"use client";

import { useEffect, useState, useRef } from "react";
import { Mic, Square, RefreshCw, Package, Trash2, X, Check, Edit2, ArrowLeft, Send, ChefHat, ClipboardList } from "lucide-react";

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionResultLike = {
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionProvider = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type ProcessedItem = {
  name: string;
  quantity?: number;
  unit?: string;
  expire_date?: string;
  action?: string;
  type?: string;
  details?: string;
  frequency?: string;
  comment?: string;
};

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
    target: string;
    items: ProcessedItem[];
    retrieval?: boolean;
  };
  message: string;
}

interface SearchResult {
  query: string;
  found: boolean;
  matches: InventoryItem[];
}

interface SearchInventoryResponse {
  success: boolean;
  results: SearchResult[];
}

interface SearchHabitsResponse {
  success: boolean;
  results: {
    query: string;
    found: boolean;
    matches: Habit[];
  }[];
}

interface UpdateInventoryResponse {
  success: boolean;
  changes: {
    type: string;
    name: string;
    desc: string;
    expire_date: string;
  }[];
  items?: InventoryItem[];
  message: string;
}

interface MealPlanResponse {
  success: boolean;
  suggestions: {
    title: string;
    rationale: string;
    description: string;
  }[];
  summary: string;
}

interface Habit {
  name: string;
  type: string;
  details: string;
  frequency: string;
  comment: string;
}

interface UpdateHabitsResponse {
  success: boolean;
  message: string;
  habits?: Habit[];
  changes?: {
    type: string;
    name: string;
    desc: string;
  }[];
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
  const [updateResponse, setUpdateResponse] = useState<UpdateInventoryResponse | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Search Results State
  const [searchResults, setSearchResults] = useState<(InventoryItem | Habit)[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'all' | 'search'>('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'habits'>('inventory');

  // Inventory State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Meal Plan State
  const [mealPlan, setMealPlan] = useState<MealPlanResponse | null>(null);
  const [isFetchingMealPlan, setIsFetchingMealPlan] = useState(false);
  const [showMealModal, setShowMealModal] = useState(false);

  // Habits State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loadingHabits, setLoadingHabits] = useState(false);
  const [showHabitsModal, setShowHabitsModal] = useState(false);
  const [habitInput, setHabitInput] = useState("");
  const [isUpdatingHabits, setIsUpdatingHabits] = useState(false);
  const [habitMessage, setHabitMessage] = useState<string | null>(null);
  const [deletingHabitName, setDeletingHabitName] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<(Habit & { old_name?: string }) | null>(null);
  const [isSavingHabitEdit, setIsSavingHabitEdit] = useState(false);

  const [recordingMode, setRecordingMode] = useState<'main' | 'habit'>('main');
  const [language, setLanguage] = useState<string>('zh-CN');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef(""); 
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingModeRef = useRef<'main' | 'habit'>('main');

  useEffect(() => {
    recordingModeRef.current = recordingMode;
  }, [recordingMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const browserLang = navigator.language;
      setLanguage(browserLang.startsWith('zh') ? 'zh-CN' : 'en-US');
    }
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
    }
  }, [language]);

  const toggleLanguage = () => {
    const newLang = language === 'zh-CN' ? 'en-US' : 'zh-CN';
    setLanguage(newLang);
    // If currently recording, we might want to restart? 
    // Usually changing lang while recording doesn't take effect until next session.
    // For simplicity, we assume user switches before recording.
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    fetchInventory();
    fetchHabits();

    if (typeof window !== "undefined") {
      const speechRecognitionProvider = window as SpeechRecognitionProvider;
      const SpeechRecognitionCtor =
        speechRecognitionProvider.SpeechRecognition || speechRecognitionProvider.webkitSpeechRecognition;

      if (!SpeechRecognitionCtor) {
        setError("当前浏览器不支持 Web Speech API");
        return;
      }

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsRecording(true);
        setStatus("正在录音... (30秒后自动结束)");
        setError(null);
        
        // Only reset main flow if in main mode
        if (recordingModeRef.current === 'main') {
            resetFlowState();
            setTranscript("");
        } else {
             // For habit mode, clear input
             setHabitInput("");
        }

        transcriptRef.current = ""; 

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

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        console.error("Speech Error:", event.error);
        if (event.error === 'no-speech') {
            setStatus("未检测到语音");
        } else {
            setError(`发生错误: ${event.error}`);
        }
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const currentFullTranscript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join("");

        transcriptRef.current = currentFullTranscript;

        if (recordingModeRef.current === 'main') {
            setTranscript(currentFullTranscript);
        } else {
            setHabitInput(currentFullTranscript);
        }

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
  /* eslint-enable react-hooks/exhaustive-deps */

  const resetFlowState = () => {
      setApiResponse(null);
      setUpdateResponse(null);
      setCountdown(null);
      setSearchResults([]); 
      setSearchMessage(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setDisplayMode('all');
  };

  const fetchInventory = async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/previewSheetData");
      if (!res.ok) throw new Error("Fetch failed");
      const data: InventoryItem[] = await res.json();
      setInventory(data);
    } catch (e) {
      console.error("Failed to fetch inventory", e);
    } finally {
      setLoadingInventory(false);
    }
  };

  const fetchMealPlan = async () => {
      setIsFetchingMealPlan(true);
      setShowMealModal(true); // Open modal immediately to show loading state
      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/recommendMealPlan");
          if (!res.ok) throw new Error("Failed to fetch meal plan");
          const data: MealPlanResponse = await res.json();
          setMealPlan(data);
      } catch (e) {
          console.error("Meal plan error", e);
          alert("无法获取饮食推荐，请稍后再试");
          setShowMealModal(false); // Close if error
      } finally {
          setIsFetchingMealPlan(false);
      }
  };

  const fetchHabits = async () => {
      setLoadingHabits(true);
      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/getHabits");
          if (!res.ok) throw new Error("Failed to fetch habits");
          const data: Habit[] = await res.json();
          setHabits(data);
      } catch (e) {
          console.error("Failed to fetch habits", e);
      } finally {
          setLoadingHabits(false);
      }
  };

  const updateHabits = async (items: ProcessedItem[]) => {
      setStatus("正在更新习惯...");
      setIsUpdating(true);
      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/updateHabits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          
          if (!res.ok) throw new Error("Update habits failed");
          
          const data: UpdateHabitsResponse = await res.json();
          const nextHabits = Array.isArray(data.habits) ? data.habits : null;
          if (nextHabits) {
              setHabits(nextHabits);
          }
          setStatus("习惯更新完成");
          
          if (data.success) {
              const fallbackHabits: Habit[] = items.map((item) => ({
                  name: item.name,
                  type: item.type || "未指定",
                  details: item.details || "",
                  frequency: item.frequency || "未指定",
                  comment: item.comment || "",
              }));
              const displayHabits = nextHabits ?? fallbackHabits;

              setSearchResults(displayHabits);
              setSearchMessage(data.message || `已更新 ${displayHabits.length} 项习惯`);
              setDisplayMode('search');
          }
      } catch (e) {
          setStatus("更新失败");
          setError("无法更新习惯");
          console.error(e);
      } finally {
          setIsUpdating(false);
      }
  };

  const handleManualUpdateHabits = async () => {
      if (!habitInput.trim()) return;
      setIsUpdatingHabits(true);
      setHabitMessage(null);
      
      try {
          // Manual update from modal still uses text for now as it's a direct entry
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/updateHabits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: habitInput }),
          });

          if (!res.ok) throw new Error("Failed to update habits");
          const data: UpdateHabitsResponse = await res.json();
          
          if (data.success) {
              if (Array.isArray(data.habits)) setHabits(data.habits);
              setHabitMessage(data.message);
              setHabitInput(""); 
              if (Array.isArray(data.habits)) {
                  setSearchResults(data.habits);
                  setSearchMessage(data.message || `已更新 ${data.habits.length} 项习惯`);
              } else {
                  setSearchResults([]);
                  setSearchMessage(data.message || "习惯已更新");
              }
              setDisplayMode('search');
          } else {
              setHabitMessage("更新失败: " + data.message);
          }
      } catch (e) {
          console.error("Error updating habits", e);
          setHabitMessage("更新发生错误");
      } finally {
          setIsUpdatingHabits(false);
      }
  };

  const openHabitsModal = () => {
      fetchHabits();
      setShowHabitsModal(true);
      setRecordingMode('habit'); // Set mode to habit when modal opens
  };

  const deleteHabit = async (name: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`确定要删除习惯 "${name}" 吗?`)) return;

      setDeletingHabitName(name);
      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/deleteHabit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
          });

          if (!res.ok) throw new Error("Delete habit failed");
          setHabits(prev => prev.filter(h => h.name !== name));
          setSearchResults(prev => prev.filter(item => ("id" in item ? true : item.name !== name)));
          setHabitMessage(`已删除 "${name}"`);
      } catch (e) {
          console.error("Failed to delete habit", e);
          setHabitMessage("删除失败");
      } finally {
          setDeletingHabitName(null);
      }
  };

  const openHabitEditModal = (habit: Habit) => {
      setEditingHabit({ ...habit, old_name: habit.name });
  };

  const handleHabitEditChange = (field: keyof Habit, value: string) => {
      if (!editingHabit) return;
      setEditingHabit({ ...editingHabit, [field]: value });
  };

  const saveHabitEdit = async () => {
      if (!editingHabit) return;
      setIsSavingHabitEdit(true);
      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/editHabit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(editingHabit),
          });

          if (!res.ok) throw new Error("Update habit failed");
          const data = await res.json();
          const updatedHabit = data.habit;

          setHabits(prev => prev.map(h => h.name === editingHabit.old_name ? updatedHabit : h));
          setSearchResults(prev => prev.map(item => ("id" in item ? item : item.name === editingHabit.old_name ? updatedHabit : item)));
          setEditingHabit(null);
          setHabitMessage(`已更新 "${updatedHabit.name}"`);
      } catch (e) {
          console.error("Failed to update habit", e);
          alert("更新失败，请重试");
      } finally {
          setIsSavingHabitEdit(false);
      }
  };

  const closeHabitsModal = () => {
      setShowHabitsModal(false);
      setRecordingMode('main'); // Reset mode when modal closes
      setHabitMessage(null);
      if (isRecording) stopRecording("Modal closed");
  };

  const deleteItem = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!confirm(`确定要删除 "${name}" 吗?`)) return;

    setDeletingId(id);
    try {
      const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/deleteInventoryItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Delete failed");
      
      setInventory(prev => prev.filter(item => item.id !== id));
      setSearchResults(prev => prev.filter(item => 'id' in item ? item.id !== id : true));
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

  const handleEditChange = (field: keyof InventoryItem, value: string) => {
      if (!editingItem) return;
      const nextValue = field === "quantity" ? Number(value) : value;
      setEditingItem({ ...editingItem, [field]: nextValue });
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

          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/editInventoryItem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) throw new Error("Update failed");

          const responseData = await res.json();
          const updatedItem = responseData.item;
          
          setInventory(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));
          setSearchResults(prev => prev.map(item => ('id' in item && item.id === editingItem.id) ? updatedItem : item));
          
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
      setCountdown(null);
      setSearchResults([]);
      setSearchMessage(null);

      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/processVoiceInput", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          
          if (!res.ok) throw new Error("API call failed");
          
          const data: ProcessVoiceResponse = await res.json();
          setApiResponse(data);
          setStatus("解析完成");

          if (data.success) {
              const target = data.data.target;
              const isRetrieval = data.data.retrieval;
              const items = data.data.items;

              if (isRetrieval) {
                  if (target === 'HABIT') {
                      searchHabits(items);
                  } else {
                      searchInventory(items);
                  }
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

  const searchInventory = async (items: ProcessedItem[]) => {
      setStatus("正在查询库存...");
      setIsSearching(true);
      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/searchInventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });

          if (!res.ok) throw new Error("Search failed");
          const data: SearchInventoryResponse = await res.json();
          
          if (data.success && data.results) {
              const allMatches = data.results.flatMap(result => result.matches);
              const foundCount = allMatches.length;
              
              setSearchResults(allMatches);
              setSearchMessage(foundCount > 0 ? `找到 ${foundCount} 条相关记录` : "未找到相关物品");
              setStatus("查询完成");
              setDisplayMode('search'); 
          } else {
              setSearchMessage("未找到相关物品");
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

  const searchHabits = async (items: ProcessedItem[]) => {
      setStatus("正在查询习惯...");
      setIsSearching(true);
      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/searchHabits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });

          if (!res.ok) throw new Error("Search habits failed");
          const data: SearchHabitsResponse = await res.json();
          
          if (data.success && data.results) {
              const allMatches = data.results.flatMap(result => result.matches);
              const foundCount = allMatches.length;
              
              setSearchResults(allMatches);
              setSearchMessage(foundCount > 0 ? `找到 ${foundCount} 条相关记录` : "未找到相关习惯");
              setStatus("查询完成");
              setDisplayMode('search'); 
          } else {
              setSearchMessage("未找到相关习惯");
              setStatus("未找到");
              setSearchResults([]);
              setDisplayMode('search');
          }

      } catch (e) {
          console.error("Search habits error", e);
          setError("查询习惯失败");
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
              
              if (data.data.target === 'HABIT') {
                  updateHabits(data.data.items);
              } else {
                  updateInventory(data.data.items);
              }
          }
      }, 1000);
  };

  const cancelAutoUpdate = () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
      setStatus("已取消自动更新，请编辑");
  };

  const updateInventory = async (items: ProcessedItem[]) => {
      setStatus("正在更新库存...");
      setIsUpdating(true);
      try {
          const res = await fetch("https://home-inventory-service-392917037016.us-central1.run.app/updateInventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          
          if (!res.ok) throw new Error("Update failed");
          
          const data: UpdateInventoryResponse = await res.json();
          setUpdateResponse(data);
          setStatus("库存更新完成");
          
          if (data.success) {
              const updatedItems = data.items ?? [];
              setSearchResults(updatedItems);
              setSearchMessage(data.message || `已更新 ${updatedItems.length} 项物品`);
              setDisplayMode('search');
          }
          
          // Refresh inventory list in background
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

  const isSearchMode = displayMode === 'search';
  const showingHabits = !isSearchMode && activeTab === 'habits';
  const showingInventory = !isSearchMode && activeTab === 'inventory';
  const currentList = isSearchMode ? searchResults : showingHabits ? habits : inventory;
  const safeCurrentList = Array.isArray(currentList) ? currentList : [];

  return (
    <div className="flex flex-col items-center min-h-screen p-4 pb-20 gap-6 font-[family-name:var(--font-geist-sans)] max-w-lg mx-auto bg-gray-50">
      <header className="w-full flex items-center justify-between mt-4">
        <div className="w-10">
            <button 
                onClick={toggleLanguage}
                className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors shadow-sm text-xs font-bold"
                title="切换语言 (Switch Language)"
            >
                {language === 'zh-CN' ? '中' : 'En'}
            </button>
        </div>
        <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">🎙 家庭库存助手</h1>
            <p className="text-xs text-gray-500">语音录入 & 库存管理</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={fetchMealPlan}
                className="w-10 h-10 flex items-center justify-center bg-orange-100 text-orange-600 rounded-full hover:bg-orange-200 transition-colors shadow-sm"
                title="饮食推荐"
            >
                <ChefHat className="w-6 h-6" />
            </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full gap-4">
        {/* Status Display */}
        <div className={`text-center py-2 px-4 rounded-full text-xs font-medium transition-colors ${
            isRecording ? "bg-red-100 text-red-600 animate-pulse border border-red-200" : 
            isProcessing || isUpdating || isSearching || isSavingEdit || isFetchingMealPlan ? "bg-blue-100 text-blue-600 border border-blue-200" : "bg-white text-gray-600 border border-gray-200 shadow-sm"
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
              {showingHabits ? <ClipboardList className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              {isSearchMode ? '查询结果' : showingHabits ? '生活习惯' : '当前库存'}
            </h2>
            
            <div className="flex items-center gap-2">
                {isSearchMode && (
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
                
                {showingInventory && !isSearchMode && (
                  <button 
                    onClick={fetchInventory} 
                    disabled={loadingInventory}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                    title="刷新库存"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-600 ${loadingInventory ? 'animate-spin' : ''}`} />
                  </button>
                )}

                {showingHabits && !isSearchMode && (
                  <>
                    <button
                      onClick={fetchHabits}
                      disabled={loadingHabits}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                      title="刷新习惯"
                    >
                      <RefreshCw className={`w-4 h-4 text-gray-600 ${loadingHabits ? 'animate-spin' : ''}`} />
                    </button>
                  </>
                )}
            </div>
          </div>

          {displayMode === 'search' && searchMessage && (
              <div className="bg-purple-50 text-purple-800 text-sm p-2 rounded-lg border border-purple-100">
                  {searchMessage}
              </div>
          )}

          {showingHabits && habitMessage && (
              <div className={`text-xs p-2 rounded ${habitMessage.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {habitMessage}
              </div>
          )}

          {!isSearchMode && (
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={() => setActiveTab('inventory')}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  activeTab === 'inventory'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                库存
              </button>
              <button
                onClick={() => setActiveTab('habits')}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  activeTab === 'habits'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                生活习惯
              </button>
            </div>
          )}

          <div className="grid gap-3">
            {showingInventory && loadingInventory && inventory.length === 0 ? (
               <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
            ) : showingHabits && loadingHabits && habits.length === 0 ? (
               <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
            ) : safeCurrentList.length > 0 ? (
              safeCurrentList.map((item, idx) => {
                const isHabit = !('id' in item);
                if (isHabit) {
                    const habit = item as Habit;
                    return (
                        <div
                            key={idx}
                            onClick={() => openHabitEditModal(habit)}
                            className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm flex justify-between items-start group cursor-pointer transition-colors active:bg-blue-50"
                        >
                            <div className="flex-1">
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-blue-500" />
                                    {habit.name}
                                    <Edit2 className="w-3 h-3 text-gray-300" />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{habit.details}</p>
                                <div className="text-[10px] text-gray-400 mt-1 flex gap-2">
                                    <span className="bg-gray-100 px-1.5 rounded">{habit.type}</span>
                                    <span>{habit.frequency}</span>
                                </div>
                            </div>
                            <button
                                onClick={(e) => deleteHabit(habit.name, e)}
                                disabled={deletingHabitName === habit.name}
                                className="p-2 -mr-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                title="删除"
                            >
                                {deletingHabitName === habit.name ? (
                                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    );
                }
                
                const invItem = item as InventoryItem;
                return (
                <div 
                  key={invItem.id} 
                  onClick={() => openEditModal(invItem)}
                  className={`bg-white p-3 rounded-lg border shadow-sm flex justify-between items-center group cursor-pointer transition-colors active:bg-gray-50 ${displayMode === 'search' ? 'border-purple-200 ring-1 ring-purple-100' : 'border-gray-100'}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                        {invItem.name}
                        <Edit2 className="w-3 h-3 text-gray-300" />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {invItem.category} · {invItem.location} · 📅 {formatDate(invItem.expireDate)}
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="text-lg font-bold text-gray-800">
                      {invItem.quantity} <span className="text-xs font-normal text-gray-500">{invItem.unit}</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => deleteItem(invItem.id, invItem.name, e)}
                    disabled={deletingId === invItem.id}
                    className="p-3 -mr-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="删除"
                  >
                    {deletingId === invItem.id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )})
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                  {isSearchMode ? '未找到相关物品' : showingHabits ? '暂无习惯数据' : '暂无库存数据'}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Edit Modal (same as before) */}
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

      {/* Edit Habit Modal */}
      {editingHabit && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-10">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-lg font-bold text-gray-900">✏️ 编辑习惯/清单</h3>
                    <button onClick={() => setEditingHabit(null)} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">名称</label>
                        <input 
                            type="text" 
                            value={editingHabit.name} 
                            onChange={(e) => handleHabitEditChange('name', e.target.value)}
                            className="w-full text-lg p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">类型</label>
                            <input 
                                type="text" 
                                value={editingHabit.type} 
                                onChange={(e) => handleHabitEditChange('type', e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">频率</label>
                            <input 
                                type="text" 
                                value={editingHabit.frequency} 
                                onChange={(e) => handleHabitEditChange('frequency', e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">详情</label>
                        <textarea 
                            value={editingHabit.details} 
                            onChange={(e) => handleHabitEditChange('details', e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">备注</label>
                        <input 
                            type="text" 
                            value={editingHabit.comment} 
                            onChange={(e) => handleHabitEditChange('comment', e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-4 pt-2 border-t">
                    <button 
                        onClick={() => setEditingHabit(null)}
                        className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={saveHabitEdit}
                        disabled={isSavingHabitEdit}
                        className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"
                    >
                        {isSavingHabitEdit ? (
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

      {/* Habits Modal */}
      {showHabitsModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-hidden">
                  <div className="flex justify-between items-center border-b pb-3">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <ClipboardList className="w-5 h-5 text-blue-500" />
                          生活习惯 & 购物清单
                      </h3>
                      <button onClick={closeHabitsModal} className="p-2 hover:bg-gray-100 rounded-full">
                          <X className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {habits.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">暂无习惯数据</div>
                      ) : (
                          habits.map((habit, idx) => (
                              <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50 flex justify-between items-start group">
                                  <div className="flex-1">
                                      <div className="flex justify-between items-start mb-1">
                                          <h4 className="font-bold text-gray-800">{habit.name}</h4>
                                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{habit.type}</span>
                                      </div>
                                      <p className="text-xs text-gray-600 mb-1">{habit.details}</p>
                                      <div className="flex gap-2 text-[10px] text-gray-400">
                                          <span>Freq: {habit.frequency}</span>
                                          {habit.comment && <span>Note: {habit.comment}</span>}
                                      </div>
                                  </div>
                                  <div className="flex flex-col gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                          onClick={() => openHabitEditModal(habit)}
                                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                          title="编辑"
                                      >
                                          <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                          onClick={(e) => deleteHabit(habit.name, e)}
                                          disabled={deletingHabitName === habit.name}
                                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                          title="删除"
                                      >
                                          {deletingHabitName === habit.name ? (
                                              <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                          ) : (
                                              <Trash2 className="w-3.5 h-3.5" />
                                          )}
                                      </button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
                  
                  {habitMessage && (
                      <div className={`text-xs p-2 rounded ${habitMessage.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {habitMessage}
                      </div>
                  )}

                  <div className="pt-2 border-t flex flex-col gap-2">
                      <label className="text-xs text-gray-500 font-medium">更新习惯 (语音/文字)</label>
                      <div className="flex gap-2">
                          <div className="flex-1 relative">
                              <textarea
                                  value={habitInput}
                                  onChange={(e) => setHabitInput(e.target.value)}
                                  placeholder="例如：我们要经常买牛奶，把香蕉删掉..."
                                  className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-12"
                                  disabled={isUpdatingHabits || isRecording}
                              />
                          </div>
                          
                          <button
                              onClick={() => isRecording ? stopRecording() : startRecording()}
                              className={`p-3 rounded-full flex-none transition-colors ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              title={isRecording ? "停止录音" : "语音输入"}
                          >
                              {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                          </button>
                          
                          <button
                              onClick={() => handleManualUpdateHabits()}
                              disabled={isUpdatingHabits || !habitInput.trim()}
                              className="p-3 bg-blue-600 text-white rounded-full flex-none hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="发送更新"
                          >
                              {isUpdatingHabits ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Meal Plan Modal */}
      {showMealModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-orange-500" /> 
                        AI 膳食推荐
                    </h3>
                    <button onClick={() => setShowMealModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {isFetchingMealPlan ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 space-y-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-orange-400" />
                            <p>正在分析库存为您生成食谱...</p>
                        </div>
                    ) : mealPlan ? (
                        <>
                            <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg text-orange-800 text-sm font-medium">
                                {mealPlan.summary}
                            </div>
                            
                            <div className="space-y-3">
                                {mealPlan.suggestions.map((plan, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                        <h4 className="font-bold text-gray-900 mb-1">{plan.title}</h4>
                                        <p className="text-xs text-orange-600 mb-2 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded">
                                            💡 {plan.rationale}
                                        </p>
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            {plan.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            暂无推荐数据
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t">
                    <button 
                        onClick={() => setShowMealModal(false)}
                        className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
      )}
      
      <footer className="text-[10px] text-gray-400 text-center pb-2">
        PWA v1.0 · &quot;Over&quot; to stop · 30s timeout
      </footer>
    </div>
  );
}
