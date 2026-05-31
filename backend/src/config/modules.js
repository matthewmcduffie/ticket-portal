// Set a module to false to disable it at startup — no code changes needed.
const MODULE_CONFIG = {
  auth: true,
  tickets: true,
  users: true,
  settings: true,
  email: true,
  discord: true,
  slack: true,
  analytics: true,
};

export async function loadModules(app) {
  for (const [name, enabled] of Object.entries(MODULE_CONFIG)) {
    if (!enabled) {
      console.log(`Module [${name}] disabled`);
      continue;
    }
    try {
      const mod = await import(`../modules/${name}/${name}.routes.js`);
      app.use(`/api/${name}`, mod.default);
      console.log(`Module [${name}] loaded`);
    } catch (err) {
      console.error(`Failed to load module [${name}]:`, err.message);
    }
  }
}
