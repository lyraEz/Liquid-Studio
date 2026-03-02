import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Download, Image as ImageIcon, Wand2, SlidersHorizontal,
  Smartphone, LayoutGrid, Github, Sun, Contrast, Droplet, Loader2,
  Palette, Moon, SunMedium, ArrowRightLeft, Undo2, Redo2, RotateCcw,
  SplitSquareHorizontal, Sparkles
} from 'lucide-react';

export default function App() {
  const [image, setImage] = useState(null); // Imagem original intocada
  const [processedImage, setProcessedImage] = useState(null); // Imagem com IA/Recortes
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiActionType, setAiActionType] = useState(''); // 'bg' ou 'anime'
  const [errorMsg, setErrorMsg] = useState('');
  
  // Controle do "Antes e Depois"
  const [showBefore, setShowBefore] = useState(false);

  // Default controls
  const defaultControls = {
    blur: 0, brightness: 100, contrast: 100, saturation: 100,
    hue: 0, sepia: 0, grayscale: 0, invert: 0
  };

  const [controls, setControls] = useState(defaultControls);

  // Sistema de Histórico (Undo/Redo)
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const controlsRef = useRef(controls);
  const processedImageRef = useRef(processedImage);

  // Mantém as refs atualizadas pra usar no histórico sem bugar o estado
  useEffect(() => { controlsRef.current = controls; }, [controls]);
  useEffect(() => { processedImageRef.current = processedImage; }, [processedImage]);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Handle image upload
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newImg = event.target.result;
        setImage(newImg);
        setProcessedImage(newImg);
        setControls(defaultControls);
        
        // Inicia o histórico
        setHistory([{ image: newImg, controls: defaultControls }]);
        setHistoryIndex(0);
      };
      reader.readAsDataURL(file);
    }
  };

  // Salva o estado atual no histórico (chamado ao soltar o clique no slider ou após IA)
  const commitHistory = (forcedImage = null, forcedControls = null) => {
    const entry = {
      image: forcedImage || processedImageRef.current,
      controls: forcedControls || { ...controlsRef.current }
    };
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(entry);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevEntry = history[historyIndex - 1];
      setProcessedImage(prevEntry.image);
      setControls(prevEntry.controls);
      setHistoryIndex(prevIndex => prevIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextEntry = history[historyIndex + 1];
      setProcessedImage(nextEntry.image);
      setControls(nextEntry.controls);
      setHistoryIndex(prevIndex => prevIndex + 1);
    }
  };

  const resetAll = () => {
    if (history.length > 0) {
      const initialEntry = history[0];
      setProcessedImage(initialEntry.image);
      setControls(initialEntry.controls);
      commitHistory(initialEntry.image, initialEntry.controls);
    }
  };

  // Update specific control
  const updateControl = (key, value) => {
    setControls(prev => ({ ...prev, [key]: value }));
  };

  // Presets
  const applyPreset = (type) => {
    let newControls = { ...defaultControls };
    if (type === 'lockscreen') newControls = { ...newControls, blur: 2, brightness: 90, contrast: 105 };
    else if (type === 'homescreen') newControls = { ...newControls, blur: 15, brightness: 80, contrast: 110, saturation: 120 };
    else if (type === 'cyberpunk') newControls = { ...newControls, hue: 180, contrast: 120, saturation: 150, brightness: 90 };
    else if (type === 'vintage') newControls = { ...newControls, sepia: 80, contrast: 90, brightness: 110 };
    
    setControls(newControls);
    commitHistory(processedImageRef.current, newControls);
  };

  // Build CSS filter string
  const getFilterString = () => {
    return `
      blur(${controls.blur}px) 
      brightness(${controls.brightness}%) 
      contrast(${controls.contrast}%) 
      saturate(${controls.saturation}%)
      hue-rotate(${controls.hue}deg)
      sepia(${controls.sepia}%)
      grayscale(${controls.grayscale}%)
      invert(${controls.invert}%)
    `;
  };

  // Chamada pra IA (Remover Fundo ou Estilo Anime)
  const runAITool = async (type) => {
    if (!processedImage) return;
    setIsProcessingAI(true);
    setAiActionType(type);
    setErrorMsg('');

    try {
      const apiKey = ""; // Injetada no runtime
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
      
      const base64Data = processedImage.split(',')[1];
      const mimeType = processedImage.match(/data:(.*?);/)[1];

      let prompt = "";
      if (type === 'bg') {
        prompt = "Remove the background of this image. Keep only the main subject and output it with a completely transparent background.";
      } else if (type === 'anime') {
        prompt = "Convert this image into a high-quality, beautiful anime style illustration. Keep the main subjects and composition similar.";
      }

      const payload = {
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { responseModalities: ["IMAGE"] }
      };

      const fetchWithRetry = async (retries = 5, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('API error');
            return await response.json();
          } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
          }
        }
      };

      const result = await fetchWithRetry();
      
      const parts = result.candidates?.[0]?.content?.parts;
      const imagePart = parts?.find(p => p.inlineData);
      
      if (imagePart?.inlineData?.data) {
        const newImageData = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        setProcessedImage(newImageData);
        setControls(defaultControls);
        commitHistory(newImageData, defaultControls); // Salva no histórico!
      } else {
        throw new Error('Falha ao processar a imagem.');
      }

    } catch (err) {
      console.error(err);
      setErrorMsg(`Deu ruim na IA, mano (${type}). Tenta dnv!`);
    } finally {
      setIsProcessingAI(false);
      setAiActionType('');
    }
  };

  // Download
  const handleDownload = () => {
    if (!processedImage) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = processedImage;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.filter = getFilterString();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'liquid-glass-art.png';
      link.href = dataUrl;
      link.click();
    };
  };

  return (
    <div className="min-h-screen font-sans text-white overflow-hidden relative flex flex-col justify-between selection:bg-white/30">
      
      {/* Dynamic Liquid Glass Background - Otimizado com transform-gpu e will-change */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-[2000ms] ease-out scale-110 transform-gpu will-change-[filter]"
        style={{
          backgroundImage: image ? `url(${image})` : 'linear-gradient(135deg, #1e1e2f, #11111c)',
          filter: image ? `blur(90px) brightness(0.4) saturate(2)` : 'none',
        }}
      />
      <div className="absolute inset-0 z-0 bg-black/40 mix-blend-overlay backdrop-blur-[2px]" />

      <canvas ref={canvasRef} className="hidden" />

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 py-6 md:py-8 flex-grow flex flex-col items-center justify-center">
        
        <div className="w-full bg-white/10 backdrop-blur-3xl border border-white/20 shadow-[0_8px_40px_0_rgba(0,0,0,0.4)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)] rounded-[2.5rem] p-6 md:p-8 flex flex-col gap-6 transition-all transform-gpu">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-white/20 to-white/5 rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] border border-white/10">
                <SlidersHorizontal className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Liquid Studio</h1>
                <p className="text-sm text-white/50 font-medium tracking-wide">Pro Editor</p>
              </div>
            </div>
            
            {processedImage && (
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                
                {/* Ferramentas de Topo: Undo, Redo, Reset */}
                <div className="flex bg-black/20 rounded-full p-1 border border-white/10 backdrop-blur-md">
                  <button 
                    onClick={undo} disabled={historyIndex <= 0}
                    className="p-2.5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all group"
                    title="Desfazer"
                  >
                    <Undo2 className="w-4 h-4 text-white group-active:-rotate-45 transition-transform" />
                  </button>
                  <button 
                    onClick={redo} disabled={historyIndex >= history.length - 1}
                    className="p-2.5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all group"
                    title="Refazer"
                  >
                    <Redo2 className="w-4 h-4 text-white group-active:rotate-45 transition-transform" />
                  </button>
                  <div className="w-px h-6 bg-white/10 self-center mx-1" />
                  <button 
                    onClick={resetAll} disabled={historyIndex <= 0}
                    className="p-2.5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all group"
                    title="Redefinir Tudo"
                  >
                    <RotateCcw className="w-4 h-4 text-white group-active:-rotate-180 transition-transform duration-500" />
                  </button>
                </div>

                <button 
                  onClick={handleDownload}
                  className="group flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-white/90 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] active:scale-95"
                >
                  <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                  <span className="hidden md:inline">Salvar</span>
                </button>
              </div>
            )}
          </header>

          {!processedImage ? (
            // Upload State
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-[60vh] border-2 border-dashed border-white/30 rounded-[2rem] flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-white/10 hover:border-white/60 transition-all duration-300 group bg-black/10"
            >
              <div className="p-6 bg-white/10 rounded-full group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xl">
                <Upload className="w-12 h-12 text-white/90" />
              </div>
              <div className="text-center">
                <p className="text-xl font-medium text-white/90 mb-2">Joga a imagem aqui, mano</p>
                <p className="text-sm text-white/50">Ou clica pra procurar no pc/celular</p>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
            </div>
          ) : (
            // Editor State
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Image Preview Area */}
              <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center justify-center bg-black/30 rounded-[2rem] p-4 md:p-8 border border-white/10 relative overflow-hidden group shadow-inner">
                
                {/* Botão Compare (Antes e Depois) flutuando */}
                <button
                  onPointerDown={() => setShowBefore(true)}
                  onPointerUp={() => setShowBefore(false)}
                  onPointerLeave={() => setShowBefore(false)}
                  className="absolute top-6 left-6 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-md px-4 py-2 rounded-full text-white/80 hover:text-white transition-all border border-white/10 flex items-center gap-2 active:scale-95 shadow-xl select-none"
                  title="Segure para ver o original"
                >
                  <SplitSquareHorizontal className="w-4 h-4" />
                  <span className="text-sm font-semibold tracking-wide">Compare</span>
                </button>

                <div className="relative w-full aspect-[9/16] max-h-[60vh] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl transition-all">
                  <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-20" />
                  
                  {/* Imagem Original (Aparece quando segura o botão Compare) */}
                  <img 
                    src={image} 
                    alt="Original" 
                    className={`absolute max-w-full max-h-full object-contain transition-opacity duration-500 ease-in-out ${showBefore ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                  />
                  
                  {/* Imagem Editada */}
                  <img 
                    src={processedImage} 
                    alt="Preview" 
                    className={`max-w-full max-h-full object-contain transition-all duration-500 ease-in-out transform-gpu will-change-[filter] ${showBefore ? 'opacity-0' : 'opacity-100'}`}
                    style={{ filter: getFilterString() }}
                  />
                </div>
                
                <button 
                  onClick={() => { setImage(null); setProcessedImage(null); setHistory([]); }}
                  className="absolute top-6 right-6 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-md p-3 rounded-full text-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110 border border-white/10"
                  title="Trocar Imagem"
                >
                  <Upload className="w-5 h-5" />
                </button>
              </div>

              {/* Controls Area */}
              <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-6 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                
                {/* AI Tools */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2 ml-2">
                    <Wand2 className="w-4 h-4" /> Bruxarias da IA
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => runAITool('bg')}
                      disabled={isProcessingAI}
                      className="relative overflow-hidden flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-400/30 hover:border-indigo-400/60 p-4 rounded-2xl font-semibold transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_4px_20px_rgba(99,102,241,0.1)]"
                    >
                      {isProcessingAI && aiActionType === 'bg' ? (
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-300" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-indigo-300 group-hover:scale-110 group-hover:-rotate-12 transition-all" />
                      )}
                      <span className="text-indigo-50 text-xs text-center">Tirar Fundo</span>
                    </button>
                    
                    <button 
                      onClick={() => runAITool('anime')}
                      disabled={isProcessingAI}
                      className="relative overflow-hidden flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-pink-500/20 to-orange-500/20 hover:from-pink-500/30 hover:to-orange-500/30 border border-pink-400/30 hover:border-pink-400/60 p-4 rounded-2xl font-semibold transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_4px_20px_rgba(236,72,153,0.1)]"
                    >
                      {isProcessingAI && aiActionType === 'anime' ? (
                        <Loader2 className="w-6 h-6 animate-spin text-pink-300" />
                      ) : (
                        <Sparkles className="w-6 h-6 text-pink-300 group-hover:scale-110 group-hover:rotate-12 transition-all" />
                      )}
                      <span className="text-pink-50 text-xs text-center">Virar Anime</span>
                    </button>
                  </div>
                  {errorMsg && <p className="text-red-400 text-sm mt-2 ml-2 font-medium">{errorMsg}</p>}
                </div>

                {/* Presets */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Estilos Prontos</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <PresetButton icon={<Smartphone className="w-5 h-5" />} label="Bloqueio" onClick={() => applyPreset('lockscreen')} />
                    <PresetButton icon={<LayoutGrid className="w-5 h-5" />} label="Inicial" onClick={() => applyPreset('homescreen')} />
                    <PresetButton icon={<Palette className="w-5 h-5" />} label="Cyber" onClick={() => applyPreset('cyberpunk')} />
                    <PresetButton icon={<SunMedium className="w-5 h-5" />} label="Retrô" onClick={() => applyPreset('vintage')} />
                  </div>
                </div>

                {/* Sliders Container */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2 mb-4 mt-2">Ajustes Finos</h3>
                  
                  <div className="flex flex-col gap-4 bg-white/5 p-5 rounded-[2rem] border border-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] transform-gpu">
                    <SliderControl icon={<Droplet />} label="Blur" value={controls.blur} min={0} max={50} onChange={(v) => updateControl('blur', v)} onDragEnd={() => commitHistory()} suffix="px" />
                    <SliderControl icon={<Sun />} label="Brilho" value={controls.brightness} min={0} max={200} onChange={(v) => updateControl('brightness', v)} onDragEnd={() => commitHistory()} />
                    <SliderControl icon={<Contrast />} label="Contraste" value={controls.contrast} min={0} max={200} onChange={(v) => updateControl('contrast', v)} onDragEnd={() => commitHistory()} />
                    <SliderControl icon={<ImageIcon />} label="Saturação" value={controls.saturation} min={0} max={200} onChange={(v) => updateControl('saturation', v)} onDragEnd={() => commitHistory()} />
                  </div>

                  <div className="flex flex-col gap-4 bg-white/5 p-5 rounded-[2rem] border border-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] mt-4 transform-gpu">
                    <SliderControl icon={<Palette />} label="Matiz (Cor)" value={controls.hue} min={0} max={360} onChange={(v) => updateControl('hue', v)} onDragEnd={() => commitHistory()} suffix="°" />
                    <SliderControl icon={<SunMedium />} label="Sépia" value={controls.sepia} min={0} max={100} onChange={(v) => updateControl('sepia', v)} onDragEnd={() => commitHistory()} />
                    <SliderControl icon={<Moon />} label="Preto e Branco" value={controls.grayscale} min={0} max={100} onChange={(v) => updateControl('grayscale', v)} onDragEnd={() => commitHistory()} />
                    <SliderControl icon={<ArrowRightLeft />} label="Inverter" value={controls.invert} min={0} max={100} onChange={(v) => updateControl('invert', v)} onDragEnd={() => commitHistory()} />
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer bolado */}
      <footer className="relative z-10 w-full py-5 flex items-center justify-center backdrop-blur-xl bg-black/20 border-t border-white/10">
        <a 
          href="https://github.com/lyraEz" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-white/60 hover:text-white transition-all duration-300 font-medium group hover:scale-105"
        >
          <span className="text-sm">Feito por</span>
          <span className="text-white font-bold tracking-wide group-hover:text-purple-300 transition-colors">lyraEz</span>
          <Github className="w-5 h-5 ml-1 group-hover:rotate-[360deg] transition-transform duration-700" />
        </a>
      </footer>

      {/* Custom Styles Inject */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Custom Scrollbar pro Glassmorphism */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }

        /* Range Slider brabo com animação */
        input[type=range] {
          -webkit-appearance: none;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          height: 6px;
          transition: background 0.3s ease;
        }
        input[type=range]:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 22px;
          width: 22px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          box-shadow: 0 0 15px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.1);
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s;
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 20px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.1);
        }
        input[type=range]::-webkit-slider-thumb:active {
          transform: scale(1.1);
          background: #f0f0f0;
        }
        
        /* Pop animation pros números */
        @keyframes popNumber {
          0% { transform: scale(1); color: rgba(255,255,255,0.8); }
          50% { transform: scale(1.3); color: #fff; background: rgba(255,255,255,0.3); }
          100% { transform: scale(1); color: rgba(255,255,255,0.8); }
        }
        .animate-pop {
          animation: popNumber 0.3s ease-out;
        }
      `}} />
    </div>
  );
}

function PresetButton({ icon, label, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="group flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl transition-all duration-300 active:scale-[0.95] shadow-[0_4px_15px_rgba(0,0,0,0.1)]"
    >
      <div className="text-white/70 group-hover:text-white group-hover:-translate-y-1 transition-all duration-300">
        {icon}
      </div>
      <span className="text-xs font-semibold tracking-wide text-white/70 group-hover:text-white transition-colors">{label}</span>
    </button>
  );
}

function SliderControl({ icon, label, value, min, max, onChange, onDragEnd, suffix = "%" }) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timeout = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <div className="group space-y-3 flex flex-col p-2 rounded-xl hover:bg-white/5 transition-colors duration-300">
      <div className="flex justify-between items-center text-sm font-medium text-white/80 transition-colors group-hover:text-white">
        <div className="flex items-center gap-2.5">
          <span className="opacity-60 group-hover:opacity-100 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
            {React.cloneElement(icon, { className: 'w-4 h-4' })}
          </span>
          <span className="tracking-wide">{label}</span>
        </div>
        <div className={`px-2 py-0.5 rounded-md text-xs font-bold transition-all duration-300 bg-white/10 group-hover:bg-white/20 ${isAnimating ? 'animate-pop shadow-[0_0_10px_rgba(255,255,255,0.5)]' : ''}`}>
          {value}{suffix}
        </div>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onDragEnd} // Salva no histórico quando solta o clique/dedo
        onTouchEnd={onDragEnd}  // Garantia pro mobile
        className="w-full cursor-pointer focus:outline-none"
      />
    </div>
  );
}


