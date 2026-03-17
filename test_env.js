const fs = require('fs');
try {
    const nodemailer = require('nodemailer');
    fs.writeFileSync('test_output.txt', 'nodemailer found at ' + require.resolve('nodemailer'));
} catch (e) {
    fs.writeFileSync('test_output.txt', 'nodemailer NOT FOUND: ' + e.message);
}
