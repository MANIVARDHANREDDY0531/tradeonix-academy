const { access, cp, mkdir, rm } = require("fs/promises");
const { constants } = require("fs");
const { join } = require("path");

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const root = process.cwd();
  const nestedSource = join(root, "outputs", "vastravathi");
  const source = await exists(join(nestedSource, "index.html")) ? nestedSource : root;
  const target = join(root, "public");

  if (!(await exists(join(source, "index.html")))) {
    throw new Error("Vastravathi index.html was not found. Check the Vercel Root Directory setting.");
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  const files = [
    "index.html",
    "styles.css",
    "script.js",
    "live-config.js",
    "vastravathi-logo.svg",
    "shipping.html",
    "returns.html",
    "privacy.html",
    "terms.html",
    "contact.html"
  ];

  for (const file of files) {
    const from = join(source, file);
    if (await exists(from)) {
      await cp(from, join(target, file), { recursive: true });
    }
  }

  const productsFile = join(source, "data", "products.json");
  if (await exists(productsFile)) {
    await mkdir(join(target, "data"), { recursive: true });
    await cp(productsFile, join(target, "data", "products.json"));
  }

  const uploadsDir = join(source, "uploads");
  if (await exists(uploadsDir)) {
    await cp(uploadsDir, join(target, "uploads"), { recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
