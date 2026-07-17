import { useState, useEffect, useCallback } from "react";

// Let's import the global useEmployees hook using @/hooks/useEmployees
import { useEmployees as useGlobalEmployees } from "@/hooks/useEmployees";

export interface MentionEmployee {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export function useMentions(
  text: string,
  setText: (v: string) => void,
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
) {
  const { activeEmployees: employees, loading } = useGlobalEmployees();
  
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerIdx, setTriggerIdx] = useState(-1);

  // Cast employees with any additional data (in our system, useEmployees has id, name, and we'll fallback to help user)
  const availableEmployees = employees as MentionEmployee[];

  const filteredEmployees = useCallback(() => {
    if (!filterQuery) return availableEmployees;
    const query = filterQuery.toLowerCase();
    return availableEmployees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp.id.toLowerCase().includes(query)
    );
  }, [availableEmployees, filterQuery]);

  const activeEmployees = filteredEmployees();

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filterQuery]);

  const handleInputChange = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    // Use current input value for sync checks
    const val = input.value;
    const cursor = input.selectionStart || 0;

    // Check for '@' trigger
    const textBefore = val.slice(0, cursor);
    const lastAt = textBefore.lastIndexOf("@");

    if (lastAt !== -1) {
      const queryText = textBefore.slice(lastAt + 1);
      const charBefore = lastAt > 0 ? textBefore[lastAt - 1] : null;

      // Rule: trigger if '@' is at start of line or after space/newline
      // Rule: trigger if no spaces in queryText (one word for start)
      const isStartTrigger = lastAt === 0 || charBefore === " " || charBefore === "\n";
      const hasSpaces = queryText.includes(" ");

      if (isStartTrigger && !hasSpaces) {
        setIsOpen(true);
        setTriggerIdx(lastAt);
        setFilterQuery(queryText.toLowerCase());
        setSelectedIndex(0);
        return;
      }
    }

    setIsOpen(false);
    setTriggerIdx(-1);
    setFilterQuery("");
  }, [inputRef]);

  const selectEmployee = useCallback((employee: MentionEmployee) => {
    const input = inputRef.current;
    if (!input || triggerIdx === -1) return;

    const value = input.value;
    const selectionStart = input.selectionStart || 0;

    const textBeforeAt = value.slice(0, triggerIdx);
    const textAfterCursor = value.slice(selectionStart);

    // Format mention with a space afterwards so they can keep typing easily
    const mentionValue = `@${employee.name} `;
    const newText = textBeforeAt + mentionValue + textAfterCursor;

    setText(newText);
    setIsOpen(false);
    setTriggerIdx(-1);
    setFilterQuery("");

    // Readjust caret/cursor position
    const newCursorPosition = triggerIdx + mentionValue.length;
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 10);
  }, [inputRef, triggerIdx, setText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || activeEmployees.length === 0) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % activeEmployees.length);
      return true;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + activeEmployees.length) % activeEmployees.length);
      return true;
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectEmployee(activeEmployees[selectedIndex]);
      return true;
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return true;
    }

    return false;
  }, [isOpen, activeEmployees, selectedIndex, selectEmployee]);

  return {
    isOpen,
    setIsOpen,
    selectedIndex,
    setSelectedIndex,
    activeEmployees,
    loading,
    handleInputChange,
    handleKeyDown,
    selectEmployee
  };
}
