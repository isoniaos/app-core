import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const addressSourcePath = new URL("../src/ui/address/address-utils.ts", import.meta.url);
const slugSourcePath = new URL("../src/chain/slug.ts", import.meta.url);
const addressOutputUrl = new URL(
  "../node_modules/.cache/address-utils-tests/address-utils.mjs",
  import.meta.url,
);
const slugOutputUrl = new URL(
  "../node_modules/.cache/address-utils-tests/slug.mjs",
  import.meta.url,
);

await mkdir(dirname(fileURLToPath(addressOutputUrl)), { recursive: true });

async function transpileModule(sourcePath, outputUrl) {
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: fileURLToPath(sourcePath),
  });

  await writeFile(outputUrl, transpiled.outputText, "utf8");
}

await transpileModule(addressSourcePath, addressOutputUrl);
await transpileModule(slugSourcePath, slugOutputUrl);

const utils = await import(`${pathToFileURL(fileURLToPath(addressOutputUrl)).href}?t=${Date.now()}`);
const slug = await import(`${pathToFileURL(fileURLToPath(slugOutputUrl)).href}?t=${Date.now()}`);

const checksumAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const lowercaseAddress = checksumAddress.toLowerCase();
const uppercaseAddress = checksumAddress.toUpperCase().replace("0X", "0x");
const invalidChecksumAddress = "0x3c44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const zeroAddress = "0x0000000000000000000000000000000000000000";

assert.equal(utils.shortenAddress(checksumAddress), "0x3C44…93BC");
assert.equal(utils.shortenAddress("0x1234"), "0x1234");

const parsedItems = utils.parseAddressListInput(
  `${lowercaseAddress}\n${checksumAddress},${zeroAddress};not-an-address\t${invalidChecksumAddress}`,
);
assert.equal(parsedItems.length, 5);
assert.equal(parsedItems[0].rawInput, lowercaseAddress);
assert.equal(parsedItems[1].rawInput, checksumAddress);
assert.equal(parsedItems[2].validation.status, "zero_address");
assert.equal(parsedItems[3].validation.status, "invalid_format");
assert.equal(parsedItems[4].validation.status, "invalid_checksum");

const lowercaseValidation = utils.validateAddressInput(lowercaseAddress);
assert.equal(lowercaseValidation.status, "valid");
assert.equal(lowercaseValidation.normalizedAddress, checksumAddress);
assert.equal(utils.normalizeAddressInput(lowercaseAddress), checksumAddress);

const uppercaseValidation = utils.validateAddressInput(uppercaseAddress);
assert.equal(uppercaseValidation.status, "valid");
assert.equal(uppercaseValidation.normalizedAddress, checksumAddress);

const checksumValidation = utils.validateAddressInput(checksumAddress);
assert.equal(checksumValidation.status, "valid");
assert.equal(checksumValidation.normalizedAddress, checksumAddress);

const invalidChecksumValidation = utils.validateAddressInput(
  invalidChecksumAddress,
);
assert.equal(invalidChecksumValidation.status, "invalid_checksum");
assert.equal(invalidChecksumValidation.isValid, false);

const zeroValidation = utils.validateAddressInput(zeroAddress);
assert.equal(zeroValidation.status, "zero_address");
assert.equal(zeroValidation.isValid, false);
assert.equal(
  utils.validateAddressInput(zeroAddress, { allowZeroAddress: true }).status,
  "valid",
);

const duplicateResult = utils.deduplicateAddressItems(
  utils.parseAddressListInput([lowercaseAddress, checksumAddress]),
);
assert.equal(duplicateResult.items.length, 1);
assert.equal(duplicateResult.duplicateCount, 1);
assert.equal(duplicateResult.removedDuplicateCount, 1);
assert.deepEqual(duplicateResult.normalizedAddresses, [checksumAddress]);

assert.equal(slug.buildOrganizationSlug("Acme Governance"), "acme-governance");
assert.equal(slug.buildOrganizationSlug("  Cafe Governance  "), "cafe-governance");
assert.match(slug.buildOrganizationSlug("абв тест"), /^org-[a-z0-9]{6,8}$/);
assert.equal(
  slug.buildOrganizationSlug("абв тест"),
  slug.buildOrganizationSlug("абв тест"),
);
assert.notEqual(slug.buildOrganizationSlug("абв тест"), "organization");

await rm(fileURLToPath(addressOutputUrl), { force: true });
await rm(fileURLToPath(slugOutputUrl), { force: true });

console.log(`Address utility tests passed from ${scriptDir}.`);
