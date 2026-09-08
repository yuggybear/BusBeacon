import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * Responsive select: native <select> on desktop, vaul Drawer action sheet on mobile.
 * @param {Array<{value: string, label: string}>} options
 */
export default function MobileSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      {/* Desktop: native select */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "hidden lg:block h-10 px-3 rounded-lg border border-input bg-background text-sm",
          className
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Mobile: vaul drawer action sheet */}
      <Drawer open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "lg:hidden flex items-center justify-between h-10 px-3 rounded-lg border border-input bg-background text-sm touch-none",
            className
          )}
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.label : placeholder || "Select"}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </button>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{placeholder || "Select an option"}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 max-h-[50vh] overflow-y-auto space-y-1">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between text-left p-3 rounded-lg text-sm touch-none",
                  o.value === value
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "hover:bg-slate-50"
                )}
              >
                {o.label}
                {o.value === value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}