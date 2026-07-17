import React, { useRef, useEffect } from "react";
import { useMentions } from "../hooks/useMentions";

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend?: (e?: React.FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onLinesChange?: (hasManyLines: boolean) => void;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Escribe un mensaje...",
  className = "",
  onKeyDown,
  onLinesChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastNotifiedIsHalfRef = useRef(false);
  const onLinesChangeRef = useRef(onLinesChange);

  useEffect(() => {
    onLinesChangeRef.current = onLinesChange;
  }, [onLinesChange]);
  
  // Auto-resize logic with stale check and fallback
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Temporarily set height to auto (with overflow hidden) to get correct scrollHeight
      textarea.style.height = "auto";
      textarea.style.overflowY = "hidden";
      
      const scrollHeight = textarea.scrollHeight;
      
      // Calculate dynamic max height based on actual line-height and padding
      const style = window.getComputedStyle(textarea);
      const lineHeight = parseInt(style.lineHeight) || 20;
      const paddingTop = parseInt(style.paddingTop) || 0;
      const paddingBottom = parseInt(style.paddingBottom) || 0;
      const borderTop = parseInt(style.borderTopWidth) || 0;
      const borderBottom = parseInt(style.borderBottomWidth) || 0;
      const totalVerticalSpacing = paddingTop + paddingBottom + borderTop + borderBottom;
      
      // Target: 15 lines
      const maxAllowedHeight = (lineHeight * 15) + totalVerticalSpacing;
      
      console.log('DEBUG: scrollHeight:', scrollHeight, 'maxAllowedHeight:', maxAllowedHeight, 'clientTop:', textarea.clientTop, 'clientHeight:', textarea.clientHeight, 'styleHeight:', textarea.style.height);
      
      if (scrollHeight > maxAllowedHeight) {
        textarea.style.height = `${maxAllowedHeight}px`;
        textarea.style.overflowY = "auto";
      } else {
        // Fallback to a minimum height for 1 line
        textarea.style.height = `${Math.max(lineHeight + totalVerticalSpacing, scrollHeight)}px`;
        textarea.style.overflowY = "hidden";
      }

      const computedLines = Math.round((scrollHeight - totalVerticalSpacing) / lineHeight);
      let isHalfOfLimit = lastNotifiedIsHalfRef.current;
      
      if (!isHalfOfLimit) {
        // Hide threshold: when lines >= 8
        if (computedLines >= 8) {
          isHalfOfLimit = true;
        }
      } else {
        // Show threshold: when lines <= 5 (safe distance to prevent layout feedback loop)
        if (computedLines <= 5) {
          isHalfOfLimit = false;
        }
      }
      
      if (onLinesChangeRef.current && lastNotifiedIsHalfRef.current !== isHalfOfLimit) {
        lastNotifiedIsHalfRef.current = isHalfOfLimit;
        onLinesChangeRef.current(isHalfOfLimit);
      }
    }
  }, [value]);

  const {
    isOpen,
    selectedIndex,
    activeEmployees,
    handleInputChange,
    handleKeyDown,
    selectEmployee,
  } = useMentions(value, onChange, textareaRef);

  // Trigger input change logic whenever local state value updates
  useEffect(() => {
    handleInputChange();
  }, [value, handleInputChange]);

  const handleLocalKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Intention interception: if useMentions handles key, stop propagation to prevent submitting form or other interactions
    const handled = handleKeyDown(e);
    if (!handled) {
      if (onKeyDown) {
        onKeyDown(e);
      }
    }
  };

  // Safe color scheme based on user initials
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500 text-white",
      "bg-emerald-500 text-white",
      "bg-violet-500 text-white",
      "bg-amber-500 text-white",
      "bg-rose-500 text-white",
      "bg-cyan-500 text-white",
      "bg-indigo-500 text-white",
    ];
    let sum = 0;
    for (let i = 0; i < name?.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors?.length];
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Floating Suggestions Picker */}
      {isOpen && activeEmployees?.length > 0 && (
        <div
          className="absolute bottom-full left-0 mb-2 w-full max-w-[280px] bg-white border border-slate-200/90 rounded-2xl p-1.5 z-[100] animate-fade-in"
          style={{
            boxShadow: "0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Menciones del equipo
            </span>
            <span className="text-[9px] font-medium text-slate-400">
              ↑↓ para navegar • Enter
            </span>
          </div>
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5 mt-1">
            {activeEmployees.map((emp, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent input from losing focus on mouse click
                    e.preventDefault();
                    selectEmployee(emp);
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                    isSelected
                      ? "bg-blue-50 text-blue-900 border-l-4 border-blue-500 scale-[1.01]"
                      : "hover:bg-slate-50 text-slate-700 border-l-4 border-transparent"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${getAvatarColor(
                      emp.name
                    )}`}
                  >
                    {getInitials(emp.name)}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-xs truncate leading-tight">
                      {emp.name}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate mt-0.5">
                      {emp.role ? emp.role.toUpperCase() : "TÉCNICO / MIEMBRO"} {emp.email ? `• ${emp.email}` : ""}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Field */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onCompositionStart={() => { (textareaRef.current as any).isComposing = true; }}
        onCompositionEnd={() => { (textareaRef.current as any).isComposing = false; }}
        onKeyDown={handleLocalKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={`${className.replace(/\bflex-1\b/g, "")} resize-none leading-5 min-h-[60px]`}
        style={{ lineHeight: "20px" }}
        autoComplete="off"
      />
    </div>
  );
};
