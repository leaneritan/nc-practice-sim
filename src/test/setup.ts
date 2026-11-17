import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// jsdom has no canvas implementation; geometry is tested separately and Chromium verifies rendering.
if (typeof HTMLCanvasElement !== 'undefined') vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
