import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const SearchableSelect = ({
    options = [],
    value,
    onChange,
    name,
    placeholder = "Select...",
    disabled = false,
    className = "",
    required = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(value || '');
    const [filteredOptions, setFilteredOptions] = useState(options);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    useEffect(() => {
        setFilteredOptions(
            options.filter(option =>
                option.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [searchTerm, options]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                // If the current search term isn't exactly one of the options, 
                // we might want to keep it (custom input) or revert it. 
                // For Mandals/Villages, custom input is allowed/expected?
                // The user requirement "fetch the mandals" implies selection, but "City/Village" often allows custom.
                // Let's assume custom input is allowed if it's a "free text with suggestions" field.
                // But the prompt implies "dropdowns". Let's stick to the current "datalist" behavior which allows text.
                // So we trigger onChange with the current searchTerm when closing if it's different?
                // Actually, we trigger onChange on every keystroke in the input.
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setSearchTerm(newValue);
        setIsOpen(true);
        onChange({ target: { name, value: newValue } });
    };

    const handleOptionClick = (option) => {
        setSearchTerm(option);
        onChange({ target: { name, value: option } });
        setIsOpen(false);
    };

    const handleInputFocus = () => {
        if (!disabled) setIsOpen(true);
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    name={name}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    autoComplete="off"
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-border-strong rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px] ${disabled ? 'bg-background text-muted-text cursor-not-allowed' : 'bg-surface text-text-primary'
                        } ${className}`}
                />
                {!disabled && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-text pointer-events-none">
                        <ChevronDown size={16} />
                    </div>
                )}
            </div>

            {isOpen && !disabled && (filteredOptions.length > 0 || searchTerm) && (
                <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option, index) => (
                            <div
                                key={`${option}-${index}`}
                                onClick={() => handleOptionClick(option)}
                                className={`px-4 py-2 cursor-pointer hover:bg-background flex items-center justify-between ${option === value ? 'bg-primary-50 text-primary-700' : 'text-sub'
                                    }`}
                            >
                                <span>{option}</span>
                                {option === value && <Check size={14} />}
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-3 text-sm text-muted-text text-center">
                            No matching options found. You can add "{searchTerm}" manually.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
