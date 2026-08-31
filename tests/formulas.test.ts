// tests/formulas.test.ts — Rechnet die Kurzschluss-Erwartungen gegen die Vendor-Module.
// Die Vendor-Module unter src/vendors/{zai,mimo} erstellt eine parallele Agentin;
// solange sie fehlen, wird dieser Test als "skip" markiert und läuft später nach.
import { test } from "node:test";
import assert from "node:assert/strict";

const close = (a, b, eps = 1e-6) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < eps;

async function loadVendor(id) {
  const candidates = [
    `../src/vendors/${id}/index.ts`,
    `../src/vendors/${id}/index.tsx`,
    `../src/vendors/${id}.ts`,
    `../src/vendors/${id}.tsx`,
  ];
  for (const path of candidates) {
    try {
      const mod = await import(path);
      if (mod && (mod.vendorModule || mod.formulas || mod.data || mod.makeFormulas)) {
        return mod;
      }
    } catch {
      // nächster Kandidat
    }
  }
  return null;
}

function resolveVendorModule(mod) {
  if (!mod) return null;
  if (mod.vendorModule) return mod.vendorModule;
  if (mod.default && (mod.default.formulas || mod.default.data || mod.default.deliverables)) return mod.default;
  if (mod.default) return mod.default;
  return mod;
}

function resolveData(vm) {
  if (!vm) return null;
  return vm.data ?? vm.vendorData ?? vm.latest ?? null;
}

function resolveFormulas(vm) {
  if (!vm) return null;
  if (vm.makeFormulas) {
    const f = vm.makeFormulas(vm.data ?? vm);
    if (f && typeof f.creditsPerRequest === "function") return f;
  }
  if (typeof vm.formulas === "function") {
    const f = vm.formulas(vm.data ?? vm);
    if (f && typeof f.creditsPerRequest === "function") return f;
  }
  if (vm.formulas && typeof vm.formulas.creditsPerRequest === "function") return vm.formulas;
  return null;
}

test("zai: Formeln für GLM-5.3 (creditsPerRequest 9,683; Lite ≈ 4.131/8.262 requests)", async (t) => {
  const mod = await loadVendor("zai");
  if (!mod) return t.skip("src/vendors/zai existiert noch nicht (parallele Agentin)");
  const vm = resolveVendorModule(mod);
  const data = resolveData(vm);
  const formulas = resolveFormulas(vm);
  if (!data || !formulas) return t.skip("zai-Vendor-Modul noch nicht vollständig");

  const peakModel = data.models.find((m) => m.id === "glm-5.3" && m.tier === "peak");
  const offPeakModel = data.models.find((m) => m.id === "glm-5.3" && m.tier === "off-peak");
  const lite = data.plans.find((p) => p.id === "lite");
  assert.ok(peakModel && peakModel.pattern, "GLM-5.3 peak-Row mit Pattern erwartet");
  assert.ok(lite, "Plan 'lite' erwartet");

  assert.ok(close(formulas.creditsPerRequest(peakModel), 9.683), `creditsPerRequest peak = ${formulas.creditsPerRequest(peakModel)}`);
  const rpm = formulas.requestsPerMonth(peakModel, "full", lite, "monthly");
  assert.ok(close(rpm, 4131, 1), `requestsPerMonth peak = ${rpm}`);
  const rpmOff = formulas.requestsPerMonth(offPeakModel, "full", lite, "monthly");
  assert.ok(close(rpmOff, 8262, 1), `requestsPerMonth off-peak = ${rpmOff}`);

  const inputUsd = formulas.fieldPriceUsd(peakModel, "input", "list", lite, "monthly");
  assert.ok(close(inputUsd, 1.4), `fieldPriceUsd(list, input) = ${inputUsd}`);
});

test("mimo: Formeln für MiMo-V2.5-Pro (creditsPerRequest 635.000; planValue ≈ 0,99)", async (t) => {
  const mod = await loadVendor("mimo");
  if (!mod) return t.skip("src/vendors/mimo existiert noch nicht (parallele Agentin)");
  const vm = resolveVendorModule(mod);
  const data = resolveData(vm);
  const formulas = resolveFormulas(vm);
  if (!data || !formulas) return t.skip("mimo-Vendor-Modul noch nicht vollständig");

  const pro = data.models.find((m) => m.id === "mimo-v2.5-pro" && m.tier === "peak");
  const lite = data.plans.find((p) => p.id === "lite");
  assert.ok(pro && pro.pattern, "MiMo-V2.5-Pro mit Pattern erwartet");
  assert.ok(lite, "Plan 'lite' erwartet");

  assert.ok(close(formulas.creditsPerRequest(pro), 635000, 1e-3), `creditsPerRequest = ${formulas.creditsPerRequest(pro)}`);
  const rpm = formulas.requestsPerMonth(pro, "full", lite, "monthly");
  assert.ok(close(rpm, 6457, 1), `requestsPerMonth = ${rpm}`);
  const pv = formulas.planValue(lite, "monthly");
  assert.ok(close(pv, 0.99, 0.01), `planValue = ${pv}`);
});