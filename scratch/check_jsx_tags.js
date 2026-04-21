const fs = require('fs');

function checkTags(file) {
    const code = fs.readFileSync(file, 'utf8');
    // very naive regex to find tags
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s+[^>]*?)?(\/?)>/g;
    let match;
    const stack = [];
    
    // strip comments
    const noComments = code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '');

    const lines = noComments.split('\n');
    lines.forEach((line, i) => {
        let m;
        const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s+[^>]*?)?(\/?)>/g;
        while ((m = re.exec(line)) !== null) {
            const isClosing = m[0].startsWith('</');
            const isSelfClosing = m[2] === '/';
            const tagName = m[1];
            
            if (!isClosing && !isSelfClosing) {
                stack.push({tag: tagName, line: i + 1});
            } else if (isClosing) {
                if (stack.length === 0) {
                    console.log(`ERROR ${file}: Found closing </${tagName}> at line ${i+1} but stack is empty`);
                    continue;
                }
                const last = stack.pop();
                if (last.tag !== tagName) {
                    console.log(`ERROR ${file}: Expected </${last.tag}> but found </${tagName}> at line ${i+1}`);
                }
            }
        }
    });

    if (stack.length > 0) {
        console.log(`ERROR ${file}: Unclosed tags:`, stack);
    } else {
        console.log(`OK ${file}: Tags seem balanced.`);
    }
}

checkTags('src/components/groups/GroupModal.tsx');
checkTags('src/components/halls/HallModal.tsx');
checkTags('src/components/teachers/TeacherModal.tsx');
checkTags('src/components/students/StudentModal.tsx');
