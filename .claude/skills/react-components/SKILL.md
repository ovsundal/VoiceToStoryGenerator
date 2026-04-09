---
name: react-components
description: Modern React (2024-2025) component and hooks best practices — functional components, TypeScript, state management, useEffect rules, and performance guidance
---

# React Component Best Practices (2024-2025)

## Component Structure

- **Functional components only** — no class components
- **One component per file** unless tightly coupled
- **Co-locate styles**: `Button/Button.tsx` + `Button/Button.css` in the same directory
- **Split when**: component exceeds ~200 lines, has multiple independent responsibilities, or is reusable elsewhere
- **Skip index re-exports** for small apps — direct imports are clearer

```typescript
// src/renderer/components/RecordButton/RecordButton.tsx
export function RecordButton({ isRecording, onPress }: RecordButtonProps) {
  return (
    <button className={isRecording ? 'recording' : ''} onClick={onPress}>
      {isRecording ? 'Stop' : 'Record'}
    </button>
  );
}
```

---

## Custom Hooks

- Always prefix with `use` (required)
- Return an **object** for multiple values, single value for one return
- Type the return value explicitly
- Extract side effects, event listeners, and complex logic into hooks

```typescript
function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);

  const start = useCallback(() => setIsRecording(true), []);
  const stop = useCallback(() => setIsRecording(false), []);

  return { isRecording, start, stop } as const;
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return { theme, setTheme } as const;
}
```

---

## State Management

For a small widget app — no Redux, no Zustand needed.

| Situation | Use |
|---|---|
| Independent pieces of state | `useState` |
| Interdependent or complex state | `useReducer` |
| Truly global state (theme, lang) | Context |
| 2–3 levels of prop passing | Just pass props |

```typescript
// Most cases — useState
const [language, setLanguage] = useState<'en' | 'no'>('en');

// Complex state with multiple related fields — useReducer
const [state, dispatch] = useReducer(appReducer, initialState);

// Theme/language that many components need — Context
const ThemeContext = createContext<'light' | 'dark'>('light');
```

---

## TypeScript with React

- **Props**: Use `interface` for object shapes
- **Children**: `React.ReactNode`
- **Don't use `React.FC<Props>`** — type props directly on the function
- **Event handlers**: `React.MouseEvent<HTMLButtonElement>`, `React.ChangeEvent<HTMLInputElement>`
- **Always type custom hook return values**

```typescript
interface RecordButtonProps {
  isRecording: boolean;
  onPress: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

// Type props directly — not React.FC
function RecordButton({ isRecording, onPress, disabled }: RecordButtonProps) { ... }

// Typed hook return
function useTheme(): { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void } {
  ...
}
```

---

## useEffect Best Practices

- **Always return cleanup** for timers, listeners, and subscriptions
- **Every value used inside must be in the dependency array** — no exceptions
- **Objects/functions** as deps must be stable (defined outside or memoized)

```typescript
// Correct — with cleanup
useEffect(() => {
  const handler = (e: KeyboardEvent) => { /* ... */ };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);

// Correct — with dependency
useEffect(() => {
  document.documentElement.dataset.theme = theme;
}, [theme]);
```

**When NOT to use useEffect:**
```typescript
// BAD — deriving state with useEffect
const [doubled, setDoubled] = useState(0);
useEffect(() => setDoubled(count * 2), [count]);

// GOOD — compute directly in render
const doubled = count * 2;

// BAD — initializing state from props in useEffect
useEffect(() => setState(props.value), []);

// GOOD — pass as initial value
const [value, setValue] = useState(props.value);
```

---

## Performance

For a small widget app — **don't optimize prematurely**.

- **`useMemo`/`useCallback`**: Skip unless profiling shows actual slowness. They add complexity and overhead.
- **`React.memo`**: Only for components that render frequently with stable props. Don't memo everything.
- **`key` prop**: Always use stable IDs in lists, never array indices.

```typescript
// Don't do this prematurely:
const result = useMemo(() => compute(data), [data]);

// Just do this:
const result = compute(data);

// Only memo if profiling confirms it's slow:
const MemoizedWidget = React.memo(ExpensiveWidget);
```

---

## Anti-patterns to Avoid

| Anti-pattern | Fix |
|---|---|
| `useEffect` for derived state | Compute directly in render |
| `useEffect` with empty `[]` but uses changing values | Add the missing deps |
| Missing cleanup (timers, listeners) | Always return a cleanup function |
| Prop drilling 5+ levels | Use Context |
| `() => handleClick()` inline in JSX | Pass `handleClick` directly |
| `React.FC<Props>` | Type props on the function directly |
| Index as `key` in lists | Use stable IDs |

---

## Quick Checklist

- [ ] Functional components, no classes
- [ ] Props typed with `interface`, not `React.FC`
- [ ] Custom hooks prefixed with `use`, return typed explicitly
- [ ] `useEffect` has cleanup where needed
- [ ] All `useEffect` dependencies are in the array
- [ ] No derived state in `useEffect` — compute in render
- [ ] No premature `useMemo`/`useCallback`/`React.memo`
- [ ] Stable `key` props in any lists
- [ ] Context only for truly global state (theme, language)
