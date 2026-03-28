// ============================================================
// ENTRY POINT
// Module scripts are deferred by default, so the DOM is ready
// by the time this runs - no DOMContentLoaded wrapper needed.
// ============================================================

import { navigate } from './router.js';

// Start on the lobby.
navigate('lobby');
