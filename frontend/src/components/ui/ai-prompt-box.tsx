"use client";

import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Paperclip, Square, X, BrainCog } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// Inject scrollbar styles once on client
function useScrollbarStyles() {
  React.useEffect(() => {
    const id = "ai-prompt-scrollbar-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.innerText = `
      *:focus-visible { outline-offset: 0 !important; }
      .ai-prompt-textarea::-webkit-scrollbar { width: 5px; }
      .ai-prompt-textarea::-webkit-scrollbar-track { background: transparent; }
      .ai-prompt-textarea::-webkit-scrollbar-thumb { background-color: #444; border-radius: 3px; }
      .ai-prompt-textarea::-webkit-scrollbar-thumb:hover { background-color: #555; }
    `;
    document.head.appendChild(el);
  }, []);
}

// ── Textarea ──────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "ai-prompt-textarea flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] resize-none",
        className
      )}
      ref={ref}
      rows={1}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// ── Tooltip ───────────────────────────────────────────────────────────────────
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#333] bg-[#1a1b1e] px-2.5 py-1 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// ── Dialog (image preview) ────────────────────────────────────────────────────
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-full max-w-[90vw] md:max-w-[760px] translate-x-[-50%] translate-y-[-50%] border border-[#333] bg-[#1a1b1e] shadow-2xl rounded-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 hover:bg-black/70 transition-all">
        <X className="h-4 w-4 text-gray-300" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("sr-only", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// ── Button ─────────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost";
  size?: "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "icon", ...props }, ref) => (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-white hover:bg-white/85 text-black",
        variant === "ghost" && "bg-transparent hover:bg-white/8 text-[#9ca3af] hover:text-[#d1d5db]",
        size === "icon" && "h-8 w-8 rounded-full",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

// ── ImageViewDialog ───────────────────────────────────────────────────────────
const ImageViewDialog: React.FC<{ imageUrl: string | null; onClose: () => void }> = ({
  imageUrl,
  onClose,
}) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 overflow-hidden">
        <DialogTitle>Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <img
            src={imageUrl}
            alt="Preview"
            className="w-full max-h-[80vh] object-contain rounded-2xl"
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// ── PromptInput context ───────────────────────────────────────────────────────
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (v: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 200,
  onSubmit: undefined,
  disabled: false,
});
const usePromptInput = () => React.useContext(PromptInputContext);

// ── PromptInput ───────────────────────────────────────────────────────────────
interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (v: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 200,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internal, setInternal] = React.useState(value ?? "");
    const handleChange = (v: string) => { setInternal(v); onValueChange?.(v); };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internal,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-2xl border border-[#2e2f33] bg-[#18191c] p-2 shadow-[0_4px_24px_rgba(0,0,0,0.32)] transition-all duration-200",
              isLoading && "border-[#3a3b3f]",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

// ── PromptInputTextarea ───────────────────────────────────────────────────────
const PromptInputTextarea: React.FC<
  { disableAutosize?: boolean; placeholder?: string } & React.ComponentProps<typeof Textarea>
> = ({ className, onKeyDown, disableAutosize = false, placeholder, ...props }) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(ref.current.scrollHeight, maxHeight)}px`
        : `min(${ref.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit?.(); }
        onKeyDown?.(e);
      }}
      className={cn("text-sm leading-relaxed", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

// ── PromptInputActions ────────────────────────────────────────────────────────
const PromptInputActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn("flex items-center gap-1.5", className)} {...props}>
    {children}
  </div>
);

// ── PromptInputAction (tooltip wrapper) ───────────────────────────────────────
const PromptInputAction: React.FC<
  React.ComponentProps<typeof Tooltip> & {
    tooltip: React.ReactNode;
    children: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
  }
> = ({ tooltip, children, side = "top", ...props }) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

// ── Main PromptInputBox ───────────────────────────────────────────────────────
export interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  (
    {
      onSend = () => {},
      isLoading = false,
      placeholder = "Ask about structure, dependencies…",
      className,
    },
    ref
  ) => {
    useScrollbarStyles();

    const [input, setInput] = React.useState("");
    const [files, setFiles] = React.useState<File[]>([]);
    const [filePreviews, setFilePreviews] = React.useState<Record<string, string>>({});
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
    const [showThink, setShowThink] = React.useState(false);

    const uploadRef = React.useRef<HTMLInputElement>(null);
    const boxRef = React.useRef<HTMLDivElement>(null);

    const isImageFile = (f: File) => f.type.startsWith("image/");

    const processFile = (f: File) => {
      if (!isImageFile(f) || f.size > 10 * 1024 * 1024) return;
      setFiles([f]);
      const reader = new FileReader();
      reader.onload = (e) => setFilePreviews({ [f.name]: e.target?.result as string });
      reader.readAsDataURL(f);
    };

    const handleDragOver = React.useCallback((e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
    }, []);
    const handleDragLeave = React.useCallback((e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
    }, []);
    const handleDrop = React.useCallback((e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      const imgs = Array.from(e.dataTransfer.files).filter(isImageFile);
      if (imgs.length) processFile(imgs[0]);
    }, []);

    const handleRemoveFile = (i: number) => {
      const f = files[i];
      if (f) setFilePreviews({});
      setFiles([]);
    };

    const handlePaste = React.useCallback((e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const f = items[i].getAsFile();
          if (f) { e.preventDefault(); processFile(f); break; }
        }
      }
    }, []);

    React.useEffect(() => {
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }, [handlePaste]);

    const handleSubmit = () => {
      if (!input.trim() && files.length === 0) return;
      const message = showThink ? `[Think: ${input}]` : input;
      onSend(message, files);
      setInput("");
      setFiles([]);
      setFilePreviews({});
    };

    const hasContent = input.trim() !== "" || files.length > 0;

    return (
      <>
        <PromptInput
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className={cn("w-full", className)}
          disabled={isLoading}
          ref={ref ?? boxRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Image previews */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1 pb-1">
              {files.map((f, i) =>
                f.type.startsWith("image/") && filePreviews[f.name] ? (
                  <div key={i} className="relative group">
                    <div
                      className="w-14 h-14 rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => setSelectedImage(filePreviews[f.name])}
                    >
                      <img
                        src={filePreviews[f.name]}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }}
                      className="absolute -top-1 -right-1 rounded-full bg-black/70 p-0.5 hover:bg-black/90 transition-colors"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Textarea */}
          <PromptInputTextarea
            placeholder={showThink ? "Ask DEX to think deeply…" : placeholder}
            className="text-sm px-3 py-2"
          />

          {/* Action bar */}
          <PromptInputActions className="justify-between px-1 pt-1">
            {/* Left controls */}
            <div className="flex items-center gap-1">
              {/* Attach file */}
              <PromptInputAction tooltip="Attach image">
                <button
                  onClick={() => uploadRef.current?.click()}
                  className="h-7 w-7 flex items-center justify-center rounded-full text-[#6b7280] hover:text-[#9ca3af] hover:bg-white/6 transition-all"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </PromptInputAction>
              <input
                ref={uploadRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) processFile(e.target.files[0]);
                  if (e.target) e.target.value = "";
                }}
              />

              {/* Think toggle */}
              <PromptInputAction tooltip={showThink ? "Disable deep analysis" : "Enable deep analysis"}>
                <button
                  type="button"
                  onClick={() => setShowThink((p) => !p)}
                  className={cn(
                    "flex items-center gap-1 h-7 px-2 rounded-full border transition-all text-xs font-medium",
                    showThink
                      ? "bg-violet-500/15 border-violet-500/60 text-violet-400"
                      : "bg-transparent border-transparent text-[#6b7280] hover:text-[#9ca3af] hover:bg-white/6"
                  )}
                >
                  <motion.div
                    animate={{ rotate: showThink ? 360 : 0, scale: showThink ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}
                  >
                    <BrainCog className="h-3.5 w-3.5" />
                  </motion.div>
                  <AnimatePresence>
                    {showThink && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        Think
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </PromptInputAction>
            </div>

            {/* Send / Stop */}
            <PromptInputAction
              tooltip={isLoading ? "Stop generation" : hasContent ? "Send message" : "Send"}
              side="top"
            >
              <Button
                variant={hasContent && !isLoading ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-full transition-all duration-150",
                  hasContent && !isLoading && "bg-white hover:bg-white/85 text-black"
                )}
                onClick={() => {
                  if (isLoading) return; // parent handles cancel
                  if (hasContent) handleSubmit();
                }}
                disabled={!hasContent && !isLoading}
              >
                {isLoading ? (
                  <Square className="h-3.5 w-3.5 fill-current animate-pulse" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>

        <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
      </>
    );
  }
);
PromptInputBox.displayName = "PromptInputBox";
