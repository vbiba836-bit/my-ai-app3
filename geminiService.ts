
import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.GEMINI_API_KEY || 'AIzaSyDF_MH1UtQfBvKQhNZmdDX5TXIOIprZ8CI' });

export const generateDailyPlan = async (userName: string, goal: string, history: any[], isSprint: boolean, isChaos: boolean) => {
  const modeContext = isChaos 
    ? "АНТИХАОС: Всё развалилось. Нужна глубокая поддержка и микро-действие (дыхание, одно слово)."
    : isSprint 
    ? "СПРИНТ: Есть энергия. Нужен рывок, но без перегруза."
    : "ЧЕРЕПАХА: Медленный, но верный шаг на 5-10 минут.";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Имя пользователя: ${userName}
      Цель: ${goal}
      История (последние 3 дня): ${JSON.stringify(history.slice(-3))}
      Текущий режим: ${modeContext}
      
      Задача: 
      1. Напиши сообщение поддержки пользователю (на русском).
      2. Дай один конкретный микро-шаг на сегодня.
      3. Подбери цитату успешного русского человека (исторического или современного), краткую биографию и его "инструменты успеха" (привычки, методы).
      
      Формат: JSON.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          step: { type: Type.STRING },
          inspiration: {
            type: Type.OBJECT,
            properties: {
              person: { type: Type.STRING },
              quote: { type: Type.STRING },
              bio: { type: Type.STRING },
              tools: { type: Type.STRING }
            },
            required: ["person", "quote", "bio", "tools"]
          }
        },
        required: ["message", "step", "inspiration"]
      }
    }
  });

  return JSON.parse(response.text.trim());
};

export const fetchBiographies = async () => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Предоставь 5 кратких биографий успешных русских людей, которые сделали себя сами (с нуля). Для каждого укажи: имя, главную мысль/цитату, путь через ошибки и конкретные инструменты/привычки, которые они использовали.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            person: { type: Type.STRING },
            quote: { type: Type.STRING },
            bio: { type: Type.STRING },
            tools: { type: Type.STRING }
          },
          required: ["person", "quote", "bio", "tools"]
        }
      }
    }
  });
  return JSON.parse(response.text.trim());
};

let currentSource: AudioBufferSourceNode | null = null;
let audioCtx: AudioContext | null = null;

export const playRitualVoice = async (text: string, gender: 'male' | 'female', onStart: () => void, onEnd: () => void) => {
  stopRitualVoice();
  onStart();
  
  try {
    const voiceName = gender === 'female' ? 'Kore' : 'Zephyr';
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      onEnd();
      return;
    }

    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioData = decode(base64Audio);
    const audioBuffer = await decodeAudioData(audioData, audioCtx, 24000, 1);
    
    currentSource = audioCtx.createBufferSource();
    currentSource.buffer = audioBuffer;
    currentSource.connect(audioCtx.destination);
    currentSource.onended = () => {
      onEnd();
      currentSource = null;
    };
    currentSource.start();
  } catch (error) {
    console.error("Voice playback failed", error);
    onEnd();
  }
};

export const pauseRitualVoice = () => {
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend();
    return true;
  }
  return false;
};

export const resumeRitualVoice = () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
    return true;
  }
  return false;
};

export const stopRitualVoice = () => {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch (e) {}
    currentSource = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
