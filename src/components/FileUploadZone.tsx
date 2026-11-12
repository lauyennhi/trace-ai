import React, { useState, useRef } from "react";
import { Upload, FileText, Paperclip, X, File, AlertCircle, Eye, Download } from "lucide-react";

export interface UploadedFileItem {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string; // Data URL or Object URL for preview/download
  textContent?: string; // Extracted text if text file
  rawFile?: File;
}

interface FileUploadZoneProps {
  files: UploadedFileItem[];
  onFilesChange: (files: UploadedFileItem[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  label?: string;
  sublabel?: string;
  accept?: string;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  files,
  onFilesChange,
  disabled = false,
  maxFiles = 5,
  maxSizeMB = 15,
  label = "Kéo & thả file bài làm vào đây, hoặc nhấp để chọn file",
  sublabel = "Hỗ trợ PDF, Word (.docx), TXT, Mã nguồn, Ảnh, ZIP (Tối đa 15MB)",
  accept = ".pdf,.doc,.docx,.txt,.md,.json,.csv,.py,.js,.ts,.html,.css,.java,.cpp,.c,.jpg,.jpeg,.png,.zip",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    setErrorMsg(null);
    const newItems: UploadedFileItem[] = [...files];

    for (let i = 0; i < fileList.length; i++) {
      if (newItems.length >= maxFiles) {
        setErrorMsg(`Chỉ được tải tối đa ${maxFiles} file.`);
        break;
      }

      const file = fileList[i];
      if (file.size > maxSizeMB * 1024 * 1024) {
        setErrorMsg(`File "${file.name}" vượt quá kích thước tối đa ${maxSizeMB}MB.`);
        continue;
      }

      try {
        const item = await readFileData(file);
        // Avoid exact duplicate by name & size
        if (!newItems.some((f) => f.name === item.name && f.size === item.size)) {
          newItems.push(item);
        }
      } catch (err) {
        console.error("Failed to read file:", file.name, err);
        setErrorMsg(`Không thể đọc nội dung file "${file.name}".`);
      }
    }

    onFilesChange(newItems);
  };

  const readFileData = (file: File): Promise<UploadedFileItem> => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isText = [
        "txt",
        "md",
        "json",
        "csv",
        "py",
        "js",
        "ts",
        "tsx",
        "jsx",
        "html",
        "css",
        "java",
        "cpp",
        "c",
        "h",
        "sql",
        "xml",
        "yaml",
        "yml",
      ].includes(ext);

      if (isText) {
        reader.onload = (e) => {
          const textContent = (e.target?.result as string) || "";
          // Create Data URL for downloading
          const dataUrl = URL.createObjectURL(file);
          resolve({
            id: "file_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            name: file.name,
            size: formatBytes(file.size),
            type: ext || "text",
            url: dataUrl,
            textContent: textContent.slice(0, 15000), // snippet up to 15k chars
            rawFile: file,
          });
        };
        reader.readAsText(file);
      } else {
        reader.onload = (e) => {
          const dataUrl = (e.target?.result as string) || URL.createObjectURL(file);
          resolve({
            id: "file_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            name: file.name,
            size: formatBytes(file.size),
            type: ext || "binary",
            url: dataUrl,
            rawFile: file,
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (id: string) => {
    if (disabled) return;
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-3">
      {/* Dropzone Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all duration-200 select-none ${
          disabled
            ? "opacity-60 cursor-not-allowed bg-surface-2 border-line"
            : isDragging
            ? "border-brand bg-brand-soft scale-[1.01]"
            : "border-line bg-surface-2 hover:bg-surface-2/60 hover:border-brand/40"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              isDragging
                ? "bg-brand text-white"
                : "bg-surface text-ink-2 shadow-xs border border-line"
            }`}
          >
            <Upload className="w-6 h-6" />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-bold text-ink">{label}</p>
            <p className="text-[11px] text-mute">{sublabel}</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-mute px-1">
            Danh sách file đã tải lên ({files.length}):
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-xl bg-surface border border-line shadow-2xs group hover:border-brand/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="p-2 rounded-lg bg-surface-2 text-ink-2 font-bold shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink truncate">{file.name}</p>
                    <p className="text-[10px] text-mute">
                      {file.size} • <span className="uppercase">{file.type}</span>
                      {file.textContent ? " • Đã trích xuất văn bản" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {file.url && (
                    <a
                      href={file.url}
                      download={file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-mute hover:text-ink rounded-lg hover:bg-surface-2 transition-colors"
                      title="Tải về / Xem file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(file.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Xóa file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
