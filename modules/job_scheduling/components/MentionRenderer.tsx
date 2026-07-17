import React from "react";

interface MentionRendererProps {
  mensaje: string;
  isMe?: boolean;
  mentions?: { userId: string; userName: string; email?: string }[];
  onMentionClick?: (userId: string) => void;
}

export const MentionRenderer: React.FC<MentionRendererProps> = ({
  mensaje,
  isMe = false,
  mentions = [],
  onMentionClick,
}) => {
  if (!mensaje) return null;

  // Compile regex that matches `@` followed by alphanumeric or accented letters and simple spaces
  // This matches `@Name` patterns like `@Diego Miranda` or `@Jonathan`
  const mentionRegex = /(@[A-ZÑa-zñáéíóúÁÉÍÓÚ0-9_.\s-]+)/g;

  // Split text by the regex
  const parts = mensaje.split(mentionRegex);

  if (parts.length <= 1) {
    return <span className="inline whitespace-pre-wrap">{mensaje}</span>;
  }

  // Set of tagged names (all lowercase for safe comparison)
  const taggedNames = new Set(
    mentions.map((m) => m.userName.toLowerCase().trim())
  );

  return (
    <span className="inline leading-relaxed select-text font-medium text-[12px] md:text-sm">
      {parts.map((part, index) => {
        const isPotentialMention = part.startsWith("@");
        const cleanName = isPotentialMention ? part.slice(1).trim() : "";
        
        // Check if this matched mention corresponds to an active or registered mention in the array,
        // or matches any name in our tagged users
        const isMatchedMention =
          isPotentialMention &&
          (taggedNames.has(cleanName.toLowerCase()) ||
            mentions.some((m) => cleanName.toLowerCase().startsWith(m.userName.toLowerCase())));

        if (isMatchedMention) {
          // Resolve matched mention userId
          const resolvedMention = mentions.find(
            (m) =>
              m.userName.toLowerCase() === cleanName.toLowerCase() ||
              cleanName.toLowerCase().startsWith(m.userName.toLowerCase())
          );

          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (resolvedMention && onMentionClick) {
                  onMentionClick(resolvedMention.userId);
                }
              }}
              className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-lg text-[11px] md:text-[12px] font-extrabold transition-all duration-150 transform hover:scale-105 active:scale-95 cursor-pointer shadow-3xs ${
                isMe
                  ? "bg-white/20 text-white border border-white/30 hover:bg-white/30"
                  : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300"
              }`}
            >
              @{resolvedMention?.userName || cleanName}
            </button>
          );
        }

        // Just regular text
        return (
          <span key={index} className="inline whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </span>
  );
};
