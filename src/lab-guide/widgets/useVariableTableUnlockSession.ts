// Unlock edit-session for a locked VariableTable cell. Opening a locked cell
// starts a transient session that renders it editable while the store lock
// entry stays in place; on blur the value is compared against the snapshot
// taken at session start, and only a real change commits the unlock. The lock
// key is snapshotted too, so an intervening edit that re-pairs this student row
// with a different expected row still clears the original entry.
import {
  type FocusEvent,
  type KeyboardEvent,
  type TouchEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

export function useVariableTableUnlockSession(args: {
  id: string;
  locked: boolean;
  lockKey: string | null;
  value: string;
  onUnlock: (lockKey: string) => void;
}): {
  isReadonlyRender: boolean;
  wrapperHandlers: {
    onDoubleClick: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLSpanElement>) => void;
    onTouchStart: (e: TouchEvent<HTMLSpanElement>) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
    onTouchMove: () => void;
  };
  onInputBlur: (e: FocusEvent<HTMLInputElement>) => void;
} {
  const { id, locked, lockKey, value, onUnlock } = args;

  // Unlock session model: opening a locked cell does NOT immediately drop the
  // store-level lock entry. Instead it starts a transient "edit session" that
  // renders the cell as editable while the lock entry stays in place. On blur
  // we compare the current value (trimmed) against the snapshot taken at
  // session start. If they match, the session ends silently — no store
  // mutation, no relock-flash dance on the next Tjek (the lock was never
  // dropped). If they differ, we commit the unlock by calling prop-`onUnlock`,
  // which clears the store entry; the next Tjek then re-validates the new
  // value and may re-lock with its usual emerald/rose flash.
  const [editingUnlocked, setEditingUnlocked] = useState(false);
  // Snapshot taken at edit-session start: the value (to detect net-zero edits)
  // and the store lock key resolved at the moment editing began. Capturing
  // the key here pins it to the matcher pairing the lock was born under, so
  // a subsequent edit that re-pairs this student row with a different
  // expected row still clears the original lock entry — not whatever the
  // matcher happens to point at on blur.
  const unlockSnapshotRef = useRef<{ value: string; lockKey: string | null } | null>(null);
  const isReadonlyRender = locked && !editingUnlocked;

  // Focus the freshly-rendered editable input on the readonly→editable
  // transition so a keyboard student can resume typing without re-Tab. Fires
  // for both genuine unlocks (locked → !locked) and session starts (locked &&
  // editingUnlocked flip), since both flip isReadonlyRender true → false.
  const prevReadonlyRef = useRef(isReadonlyRender);
  useEffect(() => {
    if (prevReadonlyRef.current && !isReadonlyRender) {
      document.getElementById(id)?.focus();
    }
    prevReadonlyRef.current = isReadonlyRender;
  }, [isReadonlyRender, id]);

  // Long-press unlock for touch. Cleared on touchend/cancel/move so a swipe-
  // scroll doesn't accidentally unlock.
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pressTimerRef.current !== null) clearTimeout(pressTimerRef.current);
    },
    [],
  );
  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // Start an edit session: snapshot the current trimmed value AND the
  // current lock key, flip the session bit. No-op if not locked, or if a
  // session is already running (re-snapshotting would lose the original
  // "before edit" value and pin to a stale key).
  const startEditSession = () => {
    if (!locked || editingUnlocked) return;
    unlockSnapshotRef.current = { value: value.trim(), lockKey };
    setEditingUnlocked(true);
  };

  // Wrapper-level handlers: the locked branch wraps its span in `Tooltip`,
  // which clones the child and overwrites onKeyDown / onClick / onTouch*
  // (see Tooltip.tsx). Catching the events on the bubble parent lets the
  // Tooltip own its child cloning while we still receive the unlock signals.
  const handleWrapperDoubleClick = () => {
    startEditSession();
  };
  const handleWrapperKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (!locked || editingUnlocked) return;
    // Enter / F2: documented keyboard-unlock keys. Space: ARIA-button
    // activation pattern — the locked-cell wrapper has role="button" so
    // Space must also trigger it (and we preventDefault to suppress the
    // browser's default page-scroll).
    if (e.key === 'Enter' || e.key === 'F2' || e.key === ' ') {
      e.preventDefault();
      startEditSession();
    }
  };
  const handleWrapperTouchStart = (_e: TouchEvent<HTMLSpanElement>) => {
    if (!locked || editingUnlocked) return;
    clearPressTimer();
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      startEditSession();
    }, 500);
  };
  const handleWrapperTouchEnd = () => clearPressTimer();
  const handleWrapperTouchCancel = () => clearPressTimer();
  const handleWrapperTouchMove = () => clearPressTimer();

  // Editable-input blur: if a session is running, decide whether the student
  // actually changed anything. Net-zero edits (typed then backspaced back to
  // the original) end the session silently with no store mutation.
  const handleInputBlur = (_e: FocusEvent<HTMLInputElement>) => {
    if (!editingUnlocked) return;
    const snapshot = unlockSnapshotRef.current;
    const changed = snapshot !== null && value.trim() !== snapshot.value;
    if (changed && snapshot.lockKey !== null) onUnlock(snapshot.lockKey);
    setEditingUnlocked(false);
    unlockSnapshotRef.current = null;
  };

  return {
    isReadonlyRender,
    wrapperHandlers: {
      onDoubleClick: handleWrapperDoubleClick,
      onKeyDown: handleWrapperKeyDown,
      onTouchStart: handleWrapperTouchStart,
      onTouchEnd: handleWrapperTouchEnd,
      onTouchCancel: handleWrapperTouchCancel,
      onTouchMove: handleWrapperTouchMove,
    },
    onInputBlur: handleInputBlur,
  };
}
