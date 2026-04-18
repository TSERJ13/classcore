const fs = require('fs');
const content = fs.readFileSync('src/app/(dashboard)/settings/page.tsx', 'utf8');
const lines = content.split('\n');
let balance = 0;
lines.forEach((line, i) => {
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div/g) || []).length;
    balance += opens - closes;
    if (balance < 0) {
        console.log(`NEGATIVE BALANCE at line ${i+1}: ${balance} (Line: ${line.trim()})`);
        balance = 0; // reset for tracking more
    }
});
console.log(`Final balance: ${balance}`);
