import { buildSVG, getBlockPositions } from "./renderer.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("renderer creates exactly one visible cube per unit", () => {
  for (const number of [1, 4, 10, 11, 47, 99, 100, 101, 347, 999, 1000]) {
    const positions = getBlockPositions(number);
    const svg = buildSVG(number);
    assert(
      positions.length === number,
      `${number} produced ${positions.length} positions`,
    );
    assert(
      (svg.match(/class="block"/g) ?? []).length === number,
      `${number} has the wrong SVG cube count`,
    );
  }
});

Deno.test("renderer separates hundred slabs and bottom-aligns remainder stacks", () => {
  const positions = getBlockPositions(347);
  const separatedFourthGroup = positions.filter(({ x }) => x >= 32.25);
  const onesColumn = separatedFourthGroup.filter(({ x }) => x === 36.25);

  assert(
    separatedFourthGroup.length === 47,
    "347 must render three hundred slabs plus 47",
  );
  assert(onesColumn.length === 7, "the ones column must contain seven cubes");
  assert(
    Math.min(...onesColumn.map(({ y }) => y)) === 3,
    "the ones column must be bottom-aligned",
  );
});

Deno.test("renderer includes dimensional faces and character features", () => {
  const svg = buildSVG(12);
  assert(svg.includes('class="numberling"'), "missing Numberling");
  assert(svg.includes('class="limbs"'), "missing limbs");
  assert(svg.includes('class="face"'), "missing face");
  assert(
    svg.includes(
      "A deterministic Numberblock character made from exactly 12 visible cubes",
    ),
    "missing accessible count",
  );
});

Deno.test("renderer rejects values it cannot depict exactly", () => {
  for (const number of [0, 1.5, 1001]) {
    let rejected = false;
    try {
      getBlockPositions(number);
    } catch (error) {
      rejected = error instanceof RangeError;
    }
    assert(rejected, `${number} should be rejected`);
  }
});
