import type { KeyboardEvent } from "react";

/** A diagram's keyboard hook: return true when the key was handled. */
export type KeyHandler = (e: KeyboardEvent) => boolean;
