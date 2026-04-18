const fs = require('fs');
const content = fs.readFileSync('src/app/(dashboard)/settings/page.tsx', 'utf8');
const lines = content.split('\n');
let balance = 0;
lines.forEach((line, i) => {
    const opens = (line.match(/<div /g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    const prevBalance = balance;
    balance += opens - closes;
    if (balance !== prevBalance) {
        // console.log(`Line ${i+1}: Balance ${balance} (${opens > closes ? '+' : '-'}${Math.abs(opens-closes)})`);
    }
});
console.log(`Final balance: ${balance}`);

// Simple stack-based tag matcher for DIVs
const tags = [];
const regex = /<div (?:[^>]*)|<\/div>/g;
let match;
while ((match = regex.exec(content)) !== null) {
    if (match[0].startsWith('<div')) {
        tags.push({ line: content.substring(0, match.index).split('\n').length });
    } else {
        tags.pop();
    }
}
console.log("Unclosed DIVs started at lines:", tags.map(t => t.line));
