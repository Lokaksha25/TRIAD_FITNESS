import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    disabled?: boolean;
    className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    disabled = false,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between
                    bg-[#1e1e2e] border border-[#3b4261] rounded-lg
                    px-3 py-2 text-left
                    text-white text-sm
                    transition-all duration-150
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#5b6b8a]'}
                    ${isOpen ? 'border-[#5b6b8a] ring-1 ring-[#5b6b8a]/30' : ''}
                `}
            >
                <span className="truncate">{selectedOption?.label || 'Select...'}</span>
                <ChevronDown
                    size={16}
                    className={`ml-2 text-[#8b8fa3] transition-transform duration-150 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="
                    absolute z-50 w-full mt-1
                    bg-[#1e1e2e] border border-[#3b4261] rounded-lg
                    shadow-lg shadow-black/30
                    overflow-hidden
                    animate-in fade-in-0 zoom-in-95 duration-100
                ">
                    <div className="py-1 max-h-52 overflow-y-auto">
                        {options.map((option, index) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                                        w-full flex items-center justify-between
                                        px-3 py-2 text-left text-sm
                                        transition-colors duration-100
                                        ${isSelected
                                            ? 'bg-[#babad361]/20 text-[#82aaff]'
                                            : 'text-[#c0caf5] hover:bg-[#292e42]'
                                        }
                                        ${index !== options.length - 1 ? 'border-b border-[#2a2e3f]' : ''}
                                    `}
                                >
                                    <span className="flex items-center gap-2">
                                        {isSelected && <Check size={14} className="text-[#82aaff]" />}
                                        <span className={isSelected ? '' : 'pl-5'}>{option.label}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
