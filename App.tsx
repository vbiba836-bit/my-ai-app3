
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DayStatus, UserState, ProgressEntry, Gender, Inspiration, AppGlobalState } from './types';
import { generateDailyPlan, playRitualVoice, stopRitualVoice, pauseRitualVoice, resumeRitualVoice, fetchBiographies } from './services/geminiService';

const App: React.FC = () => {
  const [globalState, setGlobalState] = useState<AppGlobalState>(() => {
    const saved = localStorage.getItem('sprint_turtle_global_v1');
    if (saved) return JSON.parse(saved);
    return {
      profiles: [],
      activeProfileId: null,
    };
  });

  const [nav, setNav] = useState<'active-path' | 'profile-manager' | 'biographies' | 'create-profile'>('profile-manager');
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Form states
  const [goalInput, setGoalInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [genderInput, setGenderInput] = useState<Gender>('male');
  const [bios, setBios] = useState<Inspiration[]>([]);

  useEffect(() => {
    localStorage.setItem('sprint_turtle_global_v1', JSON.stringify(globalState));
  }, [globalState]);

  const activeProfile = useMemo(() => {
    return globalState.profiles.find(p => p.id === globalState.activeProfileId) || null;
  }, [globalState.profiles, globalState.activeProfileId]);

  const updateActiveProfile = useCallback((updates: Partial<UserState>) => {
    setGlobalState(prev => ({
      ...prev,
      profiles: prev.profiles.map(p => p.id === prev.activeProfileId ? { ...p, ...updates } : p)
    }));
  }, []);

  useEffect(() => {
    if (activeProfile && !activeProfile.isInitialized) {
      setNav('create-profile');
    } else if (activeProfile) {
      setNav('active-path');
    } else {
      setNav('profile-manager');
    }
  }, [globalState.activeProfileId]);

  const loadBios = async () => {
    if (bios.length > 0) {
      setNav('biographies');
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchBiographies();
      setBios(data);
      setNav('biographies');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!nameInput.trim() || !goalInput.trim()) return;
    setIsLoading(true);
    try {
      const data = await generateDailyPlan(nameInput, goalInput, [], false, false);
      const newProfile: UserState = {
        id: crypto.randomUUID(),
        userName: nameInput,
        gender: genderInput,
        mainGoal: goalInput,
        history: [],
        currentStep: data.step,
        currentMessage: data.message,
        isSprint: false,
        isChaos: false,
        isInitialized: true,
        dailyInspiration: data.inspiration
      };
      setGlobalState(prev => ({
        profiles: [...prev.profiles, newProfile],
        activeProfileId: newProfile.id
      }));
      setNav('active-path');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Удалить этот профиль и весь его прогресс?")) {
      setGlobalState(prev => ({
        ...prev,
        profiles: prev.profiles.filter(p => p.id !== id),
        activeProfileId: prev.activeProfileId === id ? null : prev.activeProfileId
      }));
    }
  };

  const handleCheckIn = (status: DayStatus) => {
    if (!activeProfile) return;
    const entry: ProgressEntry = {
      date: new Date().toISOString(),
      status,
      step: activeProfile.currentStep,
    };
    updateActiveProfile({
      history: [...activeProfile.history, entry],
      isSprint: false,
      isChaos: false,
      currentStep: '',
      currentMessage: `Отлично, ${activeProfile.userName}. На сегодня путь завершен. Отдыхай.`
    });
  };

  const refreshDailyPlan = async (overrides?: Partial<UserState>) => {
    if (!activeProfile) return;
    setIsLoading(true);
    const contextState = { ...activeProfile, ...overrides };
    try {
      const data = await generateDailyPlan(
        contextState.userName,
        contextState.mainGoal,
        contextState.history,
        contextState.isSprint,
        contextState.isChaos
      );
      updateActiveProfile({
        ...overrides,
        currentMessage: data.message,
        currentStep: data.step,
        dailyInspiration: data.inspiration
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleVoice = () => {
    if (!activeProfile) return;
    if (isSpeaking) {
      stopRitualVoice();
      setIsSpeaking(false);
      setIsPaused(false);
    } else {
      const fullText = `${activeProfile.currentMessage}. Твой шаг на сегодня: ${activeProfile.currentStep}`;
      playRitualVoice(
        fullText, 
        activeProfile.gender, 
        () => { setIsAudioLoading(false); setIsSpeaking(true); setIsPaused(false); },
        () => { setIsSpeaking(false); setIsPaused(false); }
      );
      setIsAudioLoading(true);
    }
  };

  const handlePauseVoice = () => {
    if (isPaused) {
      resumeRitualVoice();
      setIsPaused(false);
    } else {
      pauseRitualVoice();
      setIsPaused(true);
    }
  };

  const genderTheme = (activeProfile?.gender || 'male') === 'male' 
    ? { bg: 'bg-emerald-50', primary: 'bg-emerald-600', text: 'text-emerald-900', contrastText: 'text-slate-900', accent: 'emerald' }
    : { bg: 'bg-rose-50', primary: 'bg-rose-500', text: 'text-rose-900', contrastText: 'text-slate-900', accent: 'rose' };

  // UI Components
  const ProfileList = () => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Спринт & Черепаха</h1>
          <p className="text-slate-500 text-sm font-medium">Твои пути к дисциплине</p>
        </div>

        <div className="space-y-4">
          {globalState.profiles.map(p => (
            <div 
              key={p.id}
              onClick={() => setGlobalState(prev => ({ ...prev, activeProfileId: p.id }))}
              className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${p.gender === 'male' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                  {p.gender === 'male' ? '🐢' : '🌸'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{p.userName}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[150px]">{p.mainGoal}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-right px-3">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-tighter">Дней</div>
                  <div className="text-lg font-bold text-slate-800 leading-none">{p.history.length}</div>
                </div>
                <button 
                  onClick={(e) => deleteProfile(p.id, e)}
                  className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}

          <button 
            onClick={() => setNav('create-profile')}
            className="w-full py-5 border-2 border-dashed border-slate-300 rounded-3xl text-slate-400 font-bold hover:border-slate-400 hover:text-slate-500 transition flex items-center justify-center space-x-2"
          >
            <span>+</span>
            <span>Создать новый путь</span>
          </button>
        </div>

        <button 
          onClick={loadBios}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition flex items-center justify-center space-x-2"
        >
          {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>📖</span><span>Биографии успеха</span></>}
        </button>
      </div>
    </div>
  );

  if (nav === 'create-profile') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-500 border border-white">
          <div className="flex justify-between items-center">
            <button onClick={() => setNav('profile-manager')} className="text-slate-400 hover:text-slate-600">← Назад</button>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Новый профиль</h1>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Как тебя называть?</label>
              <input 
                type="text"
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition font-bold"
                placeholder="Имя"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Твой пол (для стиля и голоса)</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setGenderInput('male')}
                  className={`py-4 rounded-2xl border-2 transition font-bold ${genderInput === 'male' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-300'}`}
                >
                  Мужчина 🐢
                </button>
                <button 
                  onClick={() => setGenderInput('female')}
                  className={`py-4 rounded-2xl border-2 transition font-bold ${genderInput === 'female' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white border-slate-100 text-slate-300'}`}
                >
                  Женщина 🌸
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Твоя текущая цель?</label>
              <input 
                type="text"
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition font-bold"
                placeholder="Напр: Изучать английский"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
              />
            </div>
          </div>

          <button 
            onClick={handleCreateProfile}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-blue-700 transition shadow-xl shadow-blue-100 flex items-center justify-center space-x-3 uppercase tracking-widest text-sm"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>Создать путь</span>}
          </button>
        </div>
      </div>
    );
  }

  if (nav === 'biographies') {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-8">
          <header className="flex justify-between items-center">
             <button onClick={() => setNav('profile-manager')} className="text-white bg-white/10 px-4 py-2 rounded-xl hover:bg-white/20 transition text-sm font-bold">← Назад</button>
             <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Биографии успеха</h1>
          </header>
          
          <div className="space-y-6">
            {bios.map((b, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-lg p-8 rounded-[2rem] border border-white/10 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl">🏆</div>
                  <h3 className="text-xl font-bold text-white">{b.person}</h3>
                </div>
                <blockquote className="text-amber-400 italic text-lg font-medium border-l-2 border-amber-500/50 pl-4">
                  «{b.quote}»
                </blockquote>
                <p className="text-slate-400 text-sm leading-relaxed">{b.bio}</p>
                <div className="bg-white/5 p-4 rounded-2xl">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">Инструментарий</span>
                  <p className="text-slate-200 text-sm font-medium">{b.tools}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (nav === 'profile-manager') return <ProfileList />;

  const todayCompleted = activeProfile?.history.some(h => new Date(h.date).toDateString() === new Date().toDateString());

  return (
    <div className={`min-h-screen ${genderTheme.bg} flex flex-col items-center p-4 md:p-8 transition-colors duration-1000`}>
      <header className="w-full max-w-2xl flex justify-between items-center mb-10 bg-white/70 backdrop-blur-xl p-4 rounded-[1.5rem] border border-white shadow-sm">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => { setGlobalState(prev => ({...prev, activeProfileId: null})); stopRitualVoice(); }} 
            className="text-2xl hover:scale-110 transition p-2 bg-white rounded-2xl shadow-sm border border-slate-100"
          >
            🏠
          </button>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">{activeProfile?.userName}</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold truncate max-w-[120px]">{activeProfile?.mainGoal}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`text-[10px] font-black px-4 py-2 rounded-xl transition uppercase tracking-widest ${showHistory ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-100'}`}
          >
            ДНЕВНИК
          </button>
        </div>
      </header>

      <main className="w-full max-w-xl space-y-6 flex-grow pb-32">
        {showHistory ? (
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-white animate-in slide-in-from-bottom-4 duration-500">
             <div className="flex justify-between items-center mb-8">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">История движения</h3>
               <button onClick={() => { if(confirm("Сбросить весь прогресс этого профиля?")) updateActiveProfile({ history: [] }) }} className="text-[10px] font-black text-rose-500 uppercase tracking-widest border border-rose-100 px-3 py-1 rounded-full">Сброс</button>
             </div>
             <div className="space-y-3">
              {[...(activeProfile?.history || [])].reverse().map((h, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 shadow-sm ${
                      h.status === DayStatus.MINIMUM ? 'bg-emerald-500' :
                      h.status === DayStatus.PARTIAL ? 'bg-amber-400' : 'bg-rose-400'
                    }`} />
                    <span className="font-bold text-slate-800 truncate">{h.step}</span>
                  </div>
                  <span className="text-slate-400 text-[10px] font-black uppercase whitespace-nowrap ml-4">{new Date(h.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main AI Interaction Card */}
            <div className={`rounded-[3rem] p-10 md:p-14 text-center space-y-10 transition-all duration-700 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden border border-white/40 ${
              activeProfile?.isChaos ? 'chaos-gradient' : activeProfile?.isSprint ? 'sprint-gradient' : 'turtle-gradient'
            }`}>
              {/* Voice Controls */}
              <div className="flex justify-center items-center space-x-4">
                {isSpeaking && (
                   <button 
                    onClick={handlePauseVoice}
                    className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-xl shadow-md border border-white/50 hover:bg-white"
                   >
                     {isPaused ? '▶️' : '⏸️'}
                   </button>
                )}
                
                <button 
                  onClick={handleToggleVoice}
                  disabled={isLoading}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-95 group overflow-hidden ${
                    isSpeaking ? 'bg-slate-900 text-white scale-110' : 'bg-white text-slate-800 hover:scale-105 border border-white shadow-xl'
                  }`}
                >
                  {isAudioLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-1" />
                      <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400 animate-pulse">Готовится речь</span>
                    </div>
                  ) : isSpeaking ? (
                    <span className="text-3xl">⏹️</span>
                  ) : (
                    <span className="text-3xl">🔊</span>
                  )}
                </button>
              </div>

              {isLoading ? (
                <div className="py-12 space-y-6">
                  <div className="h-6 bg-black/5 rounded-full w-3/4 mx-auto animate-pulse"></div>
                  <div className="h-6 bg-black/5 rounded-full w-1/2 mx-auto animate-pulse"></div>
                  <div className="h-24 bg-white/20 rounded-[2rem] w-full mt-10 animate-pulse"></div>
                </div>
              ) : (
                <div className="space-y-10 animate-in zoom-in-95 duration-700">
                  <p className="text-2xl md:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                    {activeProfile?.currentMessage}
                  </p>
                  
                  {activeProfile?.currentStep && !todayCompleted && (
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-black">Твой микро-шаг</span>
                      <div className="text-xl md:text-2xl font-black text-white bg-slate-900 p-8 rounded-[2rem] shadow-2xl border border-white/10 ring-8 ring-white/10">
                        {activeProfile.currentStep}
                      </div>
                    </div>
                  )}

                  {todayCompleted && (
                    <div className="py-6 space-y-6">
                      <div className="inline-block px-8 py-3 bg-white/60 backdrop-blur rounded-full text-emerald-800 font-black text-xs uppercase tracking-[0.2em] shadow-sm">День закрыт 🐢</div>
                      <p className="text-slate-700 font-bold text-lg">Завтра мы сделаем ещё один шаг вместе.</p>
                      <button onClick={() => refreshDailyPlan()} className="text-[10px] font-black text-blue-600 underline uppercase tracking-widest">Пересоздать шаг</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inspiration Block */}
            {activeProfile?.dailyInspiration && !isLoading && !showHistory && (
              <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-white space-y-8 animate-in slide-in-from-bottom-8 delay-300 duration-1000">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl">✨</div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Вдохновение нации</h4>
                </div>
                
                <div className="space-y-6">
                  <blockquote className="text-xl md:text-2xl italic font-bold text-slate-900 border-l-8 border-amber-400 pl-6 leading-snug">
                    «{activeProfile.dailyInspiration.quote}»
                  </blockquote>
                  <div className="space-y-1">
                    <p className="font-black text-slate-900 text-lg">— {activeProfile.dailyInspiration.person}</p>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{activeProfile.dailyInspiration.bio}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 ring-4 ring-slate-50/50">
                    <span className="text-[10px] font-black uppercase text-amber-600 block mb-2 tracking-[0.2em]">Инструменты дисциплины</span>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{activeProfile.dailyInspiration.tools}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Actions */}
            {!todayCompleted && activeProfile?.currentStep && !isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-bottom-8 delay-500 duration-1000">
                <button 
                  onClick={() => handleCheckIn(DayStatus.MINIMUM)}
                  className={`${genderTheme.primary} text-white p-6 rounded-[2rem] hover:brightness-110 transition shadow-2xl flex flex-col items-center justify-center space-y-2 border-b-4 border-black/20`}
                >
                  <span className="text-3xl">🟢</span>
                  <span className="font-black text-[10px] uppercase tracking-widest">Сделал минимум</span>
                </button>
                <button 
                  onClick={() => handleCheckIn(DayStatus.PARTIAL)}
                  className="bg-white text-slate-900 border-2 border-slate-100 p-6 rounded-[2rem] hover:bg-slate-50 transition shadow-xl flex flex-col items-center justify-center space-y-2 border-b-4 border-slate-200"
                >
                  <span className="text-3xl">🟡</span>
                  <span className="font-black text-[10px] uppercase tracking-widest">Частично</span>
                </button>
                <button 
                  onClick={() => handleCheckIn(DayStatus.FAILED_RETURNED)}
                  className="bg-slate-900 text-white p-6 rounded-[2rem] hover:bg-black transition shadow-2xl flex flex-col items-center justify-center space-y-2 border-b-4 border-black/40"
                >
                  <span className="text-3xl">🔴</span>
                  <span className="font-black text-[10px] uppercase tracking-widest">Я просто здесь</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Control Bar */}
      {!showHistory && activeProfile?.isInitialized && (
        <div className="fixed bottom-8 w-full max-w-lg px-6 z-50">
          <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] p-3 flex items-center justify-between shadow-[0_35px_60px_-15px_rgba(0,0,0,0.4)] border border-white/10 ring-1 ring-white/5">
            <button 
              onClick={() => { refreshDailyPlan({isSprint: false, isChaos: false}); }}
              className={`flex-1 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition ${!activeProfile.isSprint && !activeProfile.isChaos ? genderTheme.primary + ' text-white scale-105 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Черепаха 🐢
            </button>
            <button 
              onClick={() => { const ns = !activeProfile.isSprint; refreshDailyPlan({isSprint: ns, isChaos: false}); }}
              className={`flex-1 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition ${activeProfile.isSprint ? 'bg-blue-600 text-white scale-105 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Спринт 🏁
            </button>
            <button 
              onClick={() => { refreshDailyPlan({isChaos: true, isSprint: false}); }}
              className={`flex-1 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition ${activeProfile.isChaos ? 'bg-rose-600 text-white scale-105 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Хаос 🆘
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
