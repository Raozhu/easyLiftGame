import React from 'react';

export const Button = ({ onClick, children, className = '', disabled = false, variant = 'primary' }: any) => {
  const baseStyle = "px-4 py-2 rounded font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    secondary: "bg-gray-700 hover:bg-gray-600 text-gray-200",
    danger: "bg-red-700 hover:bg-red-600 text-white",
    success: "bg-green-700 hover:bg-green-600 text-white",
    gacha: "bg-purple-700 hover:bg-purple-600 text-white border border-purple-400"
  };
  
  // @ts-ignore
  const vStyle = variants[variant] || variants.primary;

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${vStyle} ${className}`}
    >
      {children}
    </button>
  );
};

export const ProgressBar = ({ value, max, color = "bg-green-500", label }: any) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full">
      {label && <div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{value}/{max}</span></div>}
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
};

export const Card = ({ children, className = '' }: any) => (
  <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-md ${className}`}>
    {children}
  </div>
);

export const Modal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-900 border border-gray-600 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-blue-400">{title}</h2>
        {onClose && <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>}
      </div>
      <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
        {children}
      </div>
    </div>
  </div>
);
