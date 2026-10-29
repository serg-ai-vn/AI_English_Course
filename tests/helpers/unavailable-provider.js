// Test-only preload: never imported by production code.
global.fetch = async () => ({ ok: false, status: 404 });
