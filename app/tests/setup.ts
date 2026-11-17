import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => { if (typeof document !== 'undefined') cleanup(); vi.restoreAllMocks(); });
if (typeof window !== 'undefined') window.scrollTo = (() => undefined) as typeof window.scrollTo;
if (!URL.createObjectURL) (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test';
if (!URL.revokeObjectURL) (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
