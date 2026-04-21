const fs = require('fs');

function checkTags(file) {
    const code = fs.readFileSync(file, 'utf8');
    // Remove comments
    const stripComments = code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '');
    let divDepth = 0;
    const lines = stripComments.split('\n');
    lines.forEach((line, i) => {
        const opens = (line.match(/<div(\s|>)/g) || []).length;
        const closes = (line.match(/<\/div>/g) || []).length;
        divDepth += opens - closes;
        if (opens > 0 || closes > 0) {
            // console.log(`[${i+1}] divDepth = ${divDepth} (+${opens} -${closes}): ${line.trim()}`);
        }
    });

    console.log(`[${file}] Final div depth = ${divDepth}`);
}

checkTags('src/components/groups/GroupModal.tsx');
checkTags('src/components/teachers/TeacherModal.tsx');
checkTags('src/components/students/StudentModal.tsx');
checkTags('src/components/halls/HallModal.tsx');
