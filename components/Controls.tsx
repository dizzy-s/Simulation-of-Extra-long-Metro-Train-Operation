import React from 'react';

interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  statusMessage: string;
}

export const Controls: React.FC<ControlsProps> = ({ 
  isPlaying, 
  onPlayPause, 
  onReset, 
  speed,
  onSpeedChange,
  statusMessage 
}) => {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 p-6 flex flex-col md:flex-row items-center justify-between gap-6 z-50 shadow-2xl">
      
      <div className="flex items-center gap-4">
        <button
          onClick={onPlayPause}
          className={`px-6 py-3 rounded-lg font-bold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2 ${
            isPlaying 
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20' 
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              PAUSE
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              START / RESUME
            </>
          )}
        </button>

        <button
          onClick={onReset}
          className="px-6 py-3 rounded-lg font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-all active:scale-95"
        >
          RESET
        </button>
      </div>

      {/* Status Display */}
      <div className="flex-1 text-center">
        <div className="inline-block bg-slate-900 px-6 py-2 rounded-lg border border-slate-700">
          <span className="text-blue-400 font-mono text-lg">{statusMessage}</span>
        </div>
      </div>

      {/* Speed Control */}
      <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg">
        <span className="text-xs font-bold text-slate-400 uppercase">Sim Speed</span>
        {[1, 2, 4].map(s => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
              speed === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
