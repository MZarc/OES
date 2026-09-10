'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  align?: 'left' | 'right';
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  icon,
  className = '',
  size = 'sm',
  disabled = false,
  align = 'left',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyles, setMenuStyles] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    minWidth?: number;
  }>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 160);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 220 && rect.top > spaceBelow;

    const styles: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
      minWidth?: number;
    } = {
      minWidth,
    };

    if (openUpward) {
      styles.bottom = window.innerHeight - rect.top + 6;
    } else {
      styles.top = rect.bottom + 6;
    }

    if (align === 'right') {
      const rightEdge = window.innerWidth - rect.right;
      styles.right = Math.max(8, rightEdge);
    } else {
      const leftPos = rect.left;
      if (leftPos + minWidth > window.innerWidth - 8) {
        styles.right = 8;
      } else {
        styles.left = Math.max(8, leftPos);
      }
    }

    setMenuStyles(styles);
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, align]);

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5'
      : 'px-3.5 py-2 text-xs font-medium rounded-xl gap-2';

  const menuElement =
    isOpen && mounted ? (
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: menuStyles.top !== undefined ? `${menuStyles.top}px` : undefined,
          bottom: menuStyles.bottom !== undefined ? `${menuStyles.bottom}px` : undefined,
          left: menuStyles.left !== undefined ? `${menuStyles.left}px` : undefined,
          right: menuStyles.right !== undefined ? `${menuStyles.right}px` : undefined,
          minWidth: menuStyles.minWidth ? `${menuStyles.minWidth}px` : '160px',
          maxWidth: '320px',
        }}
        className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 shadow-2xl py-1 z-[9999] animate-slide-up overflow-hidden"
      >
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100/60 no-scrollbar">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-blue-50/90 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                  <div className="truncate">
                    <div className="truncate">{option.label}</div>
                    {option.description && (
                      <div className="text-[10px] text-slate-400 font-normal truncate">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full bg-white border border-slate-200 text-slate-800 font-semibold shadow-2xs hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${sizeClasses} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
          {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ml-1.5 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {mounted && menuElement && createPortal(menuElement, document.body)}
    </div>
  );
}

