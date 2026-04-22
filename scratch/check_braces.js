const fs = require('fs');

const content = fs.readFileSync('/Users/sergitsivtsivadze/Downloads/studioflow/src/app/(dashboard)/settings/page.tsx', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;

lines.forEach((line, index) => {
    const openingBraces = (line.match(/{/g) || []).length;
    const closingBraces = (line.match(/}/g) || []).length;
    const openingParens = (line.match(/\(/g) || []).length;
    const closingParens = (line.match(/\)/g) || []).length;

    braceCount += openingBraces - closingBraces;
    parenCount += openingParens - closingParens;

    if (braceCount < 0 || parenCount < 0) {
        console.log(`IMBALANCE at line ${index + 1}: brace=${braceCount}, paren=${parenCount}`);
        // Reset to prevent flooding if it's a structural error
        if (braceCount < 0) braceCount = 0;
        if (parenCount < 0) parenCount = 0;
    }
});

console.log(`FINAL: brace=${braceCount}, paren=${parenCount}`);
