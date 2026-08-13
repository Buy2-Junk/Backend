// Jest resolver that lets TS source import files by their emitted `.js` name.
// The Prisma 7 generated client (src/generated/prisma/*.ts) uses `.js`-extension
// relative imports; Node/tsc handle this at runtime/build, Jest needs a shim here.
// Only relative imports are rewritten — bare specifiers (node_modules) are left
// untouched so package resolution is never affected.
module.exports = function resolver(request, options) {
  const isRelativeJs =
    request.startsWith(".") &&
    request.endsWith(".js") &&
    !request.endsWith(".json");

  if (isRelativeJs) {
    try {
      return options.defaultResolver(request.slice(0, -3), {
        ...options,
        extensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".node"],
      });
    } catch (error) {
      if (!error || error.code !== "MODULE_NOT_FOUND") {
        throw error;
      }
    }
  }
  return options.defaultResolver(request, options);
};
