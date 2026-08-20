// feature-restoration - generated from plugin.ts by neo-angband-mod-build
// (@rpgm-tools/neo-angband-mod-sdk). Edit the TypeScript source, not this file.

// plugin.ts
function discountRoll(ctx) {
  const { rng, cost } = ctx;
  if (cost < 5) return 0;
  if (rng.oneIn(25)) return 10;
  if (rng.oneIn(50)) return 25;
  if (rng.oneIn(150)) return 50;
  if (rng.oneIn(300)) return 75;
  if (rng.oneIn(500)) return 90;
  return 0;
}
var plugin_default = {
  api: 1,
  hooks(_ctx) {
    return {};
  },
  /**
   * `registry:store` capability. Installed only while the player's own
   * "Restore store discounts" toggle is on - a disabled rule is never called
   * at all, so a store that never discounts is core's own faithful path, not
   * a branch this mod chose to skip.
   */
  register(host, ctx) {
    if (ctx.flags["feature-restoration.discounts"] !== true) return;
    host.stores.setDiscountRoll(discountRoll);
    ctx.log?.("feature-restoration: store discount roll installed");
  }
};
export {
  plugin_default as default,
  discountRoll
};
