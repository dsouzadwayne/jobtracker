/**
 * Line Grouper - Groups text items into lines
 * Uses EOL markers and character width to merge items
 */

const LineGrouper = {
  BULLET_POINTS: ['⋅', '∙', '🞄', '•', '⦁', '⚫', '●', '⬤', '⚬', '○'],

  group(textItems) {
    const lines = [];
    let line = [];

    // Group based on hasEOL
    for (const item of textItems) {
      if (item.hasEOL) {
        if (item.text.trim() !== '') {
          line.push({ ...item });
        }
        if (line.length > 0) {
          lines.push(line);
        }
        line = [];
      } else if (item.text.trim() !== '') {
        line.push({ ...item });
      }
    }

    if (line.length > 0) {
      lines.push(line);
    }

    // Merge adjacent text items if distance is smaller than typical char width
    const typicalCharWidth = this.getTypicalCharWidth(textItems);

    for (const line of lines) {
      for (let i = line.length - 1; i > 0; i--) {
        const currentItem = line[i];
        const leftItem = line[i - 1];
        const leftItemXEnd = leftItem.x + leftItem.width;
        const distance = currentItem.x - leftItemXEnd;

        if (distance <= typicalCharWidth) {
          const shouldAddSpace = this.shouldAddSpaceBetweenText(leftItem.text, currentItem.text);
          leftItem.text += (shouldAddSpace ? ' ' : '') + currentItem.text;
          leftItem.width = (currentItem.x + currentItem.width) - leftItem.x;
          line.splice(i, 1);
        }
      }
    }

    return lines;
  },

  getTypicalCharWidth(textItems) {
    const items = textItems.filter(item => item.text.trim() !== '');

    const heightToCount = {};
    let commonHeight = 0;
    let heightMaxCount = 0;

    const fontNameToCount = {};
    let commonFontName = '';
    let fontNameMaxCount = 0;

    for (const item of items) {
      const height = Math.round(item.height);
      heightToCount[height] = (heightToCount[height] || 0) + 1;
      if (heightToCount[height] > heightMaxCount) {
        commonHeight = height;
        heightMaxCount = heightToCount[height];
      }

      fontNameToCount[item.fontName] = (fontNameToCount[item.fontName] || 0) + item.text.length;
      if (fontNameToCount[item.fontName] > fontNameMaxCount) {
        commonFontName = item.fontName;
        fontNameMaxCount = fontNameToCount[item.fontName];
      }
    }

    const commonItems = items.filter(
      item => item.fontName === commonFontName && Math.round(item.height) === commonHeight
    );

    let totalWidth = 0;
    let numChars = 0;
    for (const item of commonItems) {
      totalWidth += item.width;
      numChars += item.text.length;
    }

    return numChars > 0 ? totalWidth / numChars : 6;
  },

  shouldAddSpaceBetweenText(leftText, rightText) {
    const leftEnd = leftText[leftText.length - 1];
    const rightStart = rightText[0];
    const punctuation = [':', ',', '|', '.', ...this.BULLET_POINTS];

    if (punctuation.includes(leftEnd) && rightStart !== ' ') return true;
    if (leftEnd !== ' ' && (rightStart === '|' || this.BULLET_POINTS.includes(rightStart))) return true;

    return false;
  }
};

if (typeof window !== 'undefined') {
  window.LineGrouper = LineGrouper;
}
