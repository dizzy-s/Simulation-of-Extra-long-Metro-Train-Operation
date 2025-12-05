import React from 'react';

export const Header: React.FC = () => {
  return (
    <div className="absolute top-0 left-0 w-full p-6 z-40 pointer-events-none">
        {/* Updated to text-4xl */}
        <h1 className="text-4xl font-black tracking-tighter text-white drop-shadow-lg">
          METRO <span className="text-blue-500">SIM</span>
        </h1>
        {/* Updated to text-lg */}
        <p className="text-slate-400 text-lg mt-1 font-medium bg-slate-900/50 inline-block px-2 py-1 rounded backdrop-blur-sm border border-slate-700/50">
          Regular vs Extra-long Train Operations
        </p>
    </div>
  );
};