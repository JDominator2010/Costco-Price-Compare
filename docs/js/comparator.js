/**
 * Price-per-unit comparison logic.
 */

const NEARLY_EQUAL_PCT = 2.0;

export function compare(costco, walmart) {
  const cPpu = costco.pricePerUnit;
  const wPpu = walmart.pricePerUnit;

  let percentDiff = 0, ppuDiff = 0, dollarSavings = 0;
  let cheaper = "Equal", color = "yellow";

  if (cPpu > 0 && wPpu > 0) {
    const avg = (cPpu + wPpu) / 2;
    percentDiff = Math.abs(cPpu - wPpu) / avg * 100;
    ppuDiff = cPpu - wPpu; // positive = Walmart cheaper
    dollarSavings = Math.abs(cPpu - wPpu);

    if (percentDiff < NEARLY_EQUAL_PCT) {
      cheaper = "Equal"; color = "yellow";
    } else if (wPpu < cPpu) {
      cheaper = "Walmart"; color = "green";
    } else {
      cheaper = "Costco"; color = "blue";
    }
  }

  const equivWalmartPrice = wPpu * costco.totalQty;
  const equivSavings = costco.price - equivWalmartPrice;

  return {
    costco, walmart, cheaper, color,
    percentDiff: +percentDiff.toFixed(2),
    ppuDiff: +ppuDiff.toFixed(6),
    dollarSavings: +dollarSavings.toFixed(4),
    equivWalmartPrice: +equivWalmartPrice.toFixed(2),
    equivSavings: +equivSavings.toFixed(2),
  };
}
