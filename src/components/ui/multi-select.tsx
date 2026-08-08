/**
 * Multi-Select Component
 * For selecting multiple items (sizes, colors, tags)
 */

"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface MultiSelectProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({
  label,
  value,
  onChange,
  placeholder = "Type and press Enter",
}: MultiSelectProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
      }
      setInputValue("");
    }
  };

  const handleRemove = (item: string) => {
    onChange(value.filter((v) => v !== item));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground/80 mb-1">
        {label}
      </label>
      <div className="border border-input rounded-lg p-2 focus-within:ring-2 focus-within:ring-ring">
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/15 text-primary text-sm rounded"
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="hover:text-primary"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full outline-none text-sm"
        />
      </div>
    </div>
  );
}

