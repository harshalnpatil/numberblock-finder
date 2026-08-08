type Color = {
  fill: string;
  stroke: string;
  highlight: string;
  shadow: string;
};

type BlockPosition = {
  x: number;
  y: number;
};

const COLORS: Record<number, Color> = {
  1: {
    fill: "#E53935",
    stroke: "#8E1714",
    highlight: "#FF7773",
    shadow: "#A6201D",
  },
  2: {
    fill: "#FB8C00",
    stroke: "#A63C00",
    highlight: "#FFBC55",
    shadow: "#C55A00",
  },
  3: {
    fill: "#FDD835",
    stroke: "#B47700",
    highlight: "#FFF27A",
    shadow: "#D6A900",
  },
  4: {
    fill: "#43A047",
    stroke: "#1E6124",
    highlight: "#79D27D",
    shadow: "#277A2C",
  },
  5: {
    fill: "#1E88E5",
    stroke: "#0B4E8B",
    highlight: "#69B8FF",
    shadow: "#1268B3",
  },
  6: {
    fill: "#8E24AA",
    stroke: "#521164",
    highlight: "#C66BDA",
    shadow: "#6A1680",
  },
  7: {
    fill: "#3949AB",
    stroke: "#1B286C",
    highlight: "#7785DB",
    shadow: "#283682",
  },
  8: {
    fill: "#EC407A",
    stroke: "#941843",
    highlight: "#FF83A9",
    shadow: "#BD285B",
  },
  9: {
    fill: "#00897B",
    stroke: "#004E46",
    highlight: "#4DC5B8",
    shadow: "#00695F",
  },
  0: {
    fill: "#BDBDBD",
    stroke: "#616161",
    highlight: "#EEEEEE",
    shadow: "#8D8D8D",
  },
};

function getPrimaryColor(number: number): Color {
  if (number <= 9) return COLORS[number];
  const ones = number % 10;
  return COLORS[ones || Math.floor(number / 10) % 10 || 0];
}

function addRectangle(
  positions: BlockPosition[],
  startX: number,
  columns: number,
  rows: number,
) {
  for (let x = 0; x < columns; x++) {
    for (let y = 0; y < rows; y++) positions.push({ x: startX + x, y });
  }
}

function addTensAndOnes(
  positions: BlockPosition[],
  startX: number,
  number: number,
): number {
  const tens = Math.floor(number / 10);
  const ones = number % 10;
  addRectangle(positions, startX, tens, 10);

  // The ones form a bottom-aligned stack beside the complete columns of ten.
  for (let y = 10 - ones; y < 10; y++) positions.push({ x: startX + tens, y });
  return tens + (ones ? 1 : 0);
}

/** Build one position per visible cube. The returned length is always `number`. */
export function getBlockPositions(number: number): BlockPosition[] {
  if (!Number.isInteger(number) || number < 1 || number > 1000) {
    throw new RangeError("SVG rendering supports whole numbers from 1 to 1000");
  }

  const positions: BlockPosition[] = [];
  const smallShapes: Record<number, [number, number]> = {
    1: [1, 1],
    2: [1, 2],
    3: [1, 3],
    4: [2, 2],
    5: [1, 5],
    6: [2, 3],
    7: [1, 7],
    8: [2, 4],
    9: [3, 3],
    10: [2, 5],
  };

  if (number <= 10) {
    const [columns, rows] = smallShapes[number];
    addRectangle(positions, 0, columns, rows);
    return positions;
  }

  if (number < 100) {
    addTensAndOnes(positions, 0, number);
    return positions;
  }

  const hundreds = Math.floor(number / 100);
  const remainder = number % 100;
  let startX = 0;

  // Each hundred is a distinct 10 x 10 slab. A small logical gap keeps the
  // place-value groups readable without hiding or merging any cubes.
  for (let group = 0; group < hundreds; group++) {
    addRectangle(positions, startX, 10, 10);
    startX += 10.75;
  }

  if (remainder) addTensAndOnes(positions, startX, remainder);
  return positions;
}

function cube(
  position: BlockPosition,
  index: number,
  left: number,
  top: number,
  cellSize: number,
  blockSize: number,
  color: Color,
): string {
  const x = left + position.x * cellSize;
  const y = top + position.y * cellSize;
  const bevel = Math.max(1, blockSize * 0.14);
  const radius = Math.max(1, blockSize * 0.1);

  return `<g class="block" data-block-index="${index + 1}">
    <rect x="${x}" y="${y}" width="${blockSize}" height="${blockSize}" rx="${radius}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="${
    Math.max(0.8, blockSize * 0.055)
  }"/>
    <path d="M ${x + radius} ${y + bevel} L ${x + bevel} ${y + radius} L ${
    x + blockSize - bevel
  } ${y + radius} L ${x + blockSize - radius} ${
    y + bevel
  } Z" fill="${color.highlight}" opacity="0.75"/>
    <path d="M ${x + blockSize - bevel} ${y + radius} L ${
    x + blockSize - radius
  } ${y + bevel} L ${x + blockSize - radius} ${y + blockSize - bevel} L ${
    x + blockSize - bevel
  } ${y + blockSize - radius} Z" fill="${color.shadow}" opacity="0.8"/>
    <path d="M ${x + bevel} ${y + blockSize - radius} L ${
    x + blockSize - bevel
  } ${y + blockSize - radius}" stroke="${color.stroke}" stroke-width="${
    Math.max(0.7, blockSize * 0.04)
  }" opacity="0.7"/>
  </g>`;
}

export function buildSVG(number: number): string {
  const positions = getBlockPositions(number);
  const color = getPrimaryColor(number);
  const logicalWidth = Math.max(...positions.map(({ x }) => x + 1));
  const logicalHeight = Math.max(...positions.map(({ y }) => y + 1));
  const cellSize = Math.min(44, 980 / logicalWidth, 510 / logicalHeight);
  const blockGap = Math.max(1, cellSize * 0.055);
  const blockSize = cellSize - blockGap;
  const sideRoom = 64;
  const topRoom = 105;
  const bottomRoom = 58;
  const gridWidth = logicalWidth * cellSize - blockGap;
  const gridHeight = logicalHeight * cellSize - blockGap;
  const width = Math.ceil(gridWidth + sideRoom * 2);
  const height = Math.ceil(gridHeight + topRoom + bottomRoom);
  const left = (width - gridWidth) / 2;
  const top = topRoom;
  const bodyCenterX = width / 2;
  const numberText = number.toLocaleString("en-US");
  const numberlingWidth = Math.max(58, 30 + numberText.length * 22);
  const numberlingX = (width - numberlingWidth) / 2;
  const numberlingFontSize = numberText.length > 3 ? 24 : 30;

  const blocks = positions
    .map((position, index) =>
      cube(position, index, left, top, cellSize, blockSize, color)
    )
    .join("\n");

  const faceScale = Math.max(0.7, Math.min(1.15, blockSize / 34));
  const faceX = blockSize >= 24
    ? left +
      (positions.reduce((best, position) =>
          position.y < best.y ||
            (position.y === best.y &&
              Math.abs(position.x - logicalWidth / 2) <
                Math.abs(best.x - logicalWidth / 2))
            ? position
            : best
        ).x + 0.5) * cellSize
    : bodyCenterX;
  const faceY = blockSize >= 24
    ? top + blockSize * 0.52
    : top + Math.min(42, gridHeight * 0.3);
  const eyeY = faceY - 5 * faceScale;
  const eyeOffset = 8 * faceScale;
  const eyeRadius = 5 * faceScale;
  const pupilRadius = 2.3 * faceScale;
  const armY = top + Math.min(gridHeight * 0.45, 135);
  const bodyBottom = top + gridHeight;
  const legInset = Math.min(gridWidth * 0.25, 42);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title description">
  <title id="title">Numberblock ${numberText}</title>
  <desc id="description">A deterministic Numberblock character made from exactly ${numberText} visible cubes.</desc>
  <rect width="100%" height="100%" fill="white" rx="18"/>
  <g class="numberling">
    <path d="M ${bodyCenterX} 88 L ${bodyCenterX - 7} 99 L ${
    bodyCenterX + 7
  } 99 Z" fill="white" stroke="${color.stroke}" stroke-width="2.5"/>
    <rect x="${numberlingX}" y="16" width="${numberlingWidth}" height="66" rx="28" fill="white" stroke="${color.stroke}" stroke-width="3"/>
    <text x="${bodyCenterX}" y="50" text-anchor="middle" dominant-baseline="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="900" font-size="${numberlingFontSize}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="0.9" paint-order="stroke">${numberText}</text>
  </g>
  <g class="limbs" fill="none" stroke="${color.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M ${left + 2} ${armY} Q ${left - 28} ${armY - 6} ${left - 40} ${
    armY + 20
  }"/>
    <path d="M ${left + gridWidth - 2} ${armY} Q ${left + gridWidth + 28} ${
    armY - 6
  } ${left + gridWidth + 40} ${armY + 20}"/>
    <circle cx="${left - 42}" cy="${armY + 23}" r="6" fill="${color.fill}"/>
    <circle cx="${left + gridWidth + 42}" cy="${
    armY + 23
  }" r="6" fill="${color.fill}"/>
    <path d="M ${bodyCenterX - legInset} ${bodyBottom - 2} Q ${
    bodyCenterX - legInset - 2
  } ${bodyBottom + 24} ${bodyCenterX - legInset - 12} ${bodyBottom + 38}"/>
    <path d="M ${bodyCenterX + legInset} ${bodyBottom - 2} Q ${
    bodyCenterX + legInset + 2
  } ${bodyBottom + 24} ${bodyCenterX + legInset + 12} ${bodyBottom + 38}"/>
    <path d="M ${bodyCenterX - legInset - 21} ${bodyBottom + 40} Q ${
    bodyCenterX - legInset - 9
  } ${bodyBottom + 32} ${bodyCenterX - legInset + 1} ${bodyBottom + 40}"/>
    <path d="M ${bodyCenterX + legInset - 1} ${bodyBottom + 40} Q ${
    bodyCenterX + legInset + 9
  } ${bodyBottom + 32} ${bodyCenterX + legInset + 21} ${bodyBottom + 40}"/>
  </g>
  <g class="blocks">${blocks}</g>
  <g class="face">
    <ellipse cx="${faceX - eyeOffset}" cy="${eyeY}" rx="${eyeRadius}" ry="${
    eyeRadius * 1.2
  }" fill="white" stroke="#242424" stroke-width="1.5"/>
    <ellipse cx="${faceX + eyeOffset}" cy="${eyeY}" rx="${eyeRadius}" ry="${
    eyeRadius * 1.2
  }" fill="white" stroke="#242424" stroke-width="1.5"/>
    <circle cx="${faceX - eyeOffset + faceScale}" cy="${
    eyeY + faceScale
  }" r="${pupilRadius}" fill="#242424"/>
    <circle cx="${faceX + eyeOffset + faceScale}" cy="${
    eyeY + faceScale
  }" r="${pupilRadius}" fill="#242424"/>
    <path d="M ${faceX - 8 * faceScale} ${faceY + 6 * faceScale} Q ${faceX} ${
    faceY + 15 * faceScale
  } ${faceX + 8 * faceScale} ${
    faceY + 6 * faceScale
  }" fill="white" stroke="#242424" stroke-width="${
    2.4 * faceScale
  }" stroke-linecap="round"/>
  </g>
</svg>`;
}
