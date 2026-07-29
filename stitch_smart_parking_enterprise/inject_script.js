const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const scriptTag = '\n<script src="../navigation.js"></script>\n';

fs.readdir(baseDir, { withFileTypes: true }, (err, files) => {
    if (err) throw err;
    
    files.forEach(file => {
        if (file.isDirectory() && file.name !== 'node_modules' && !file.name.startsWith('.')) {
            const codeHtmlPath = path.join(baseDir, file.name, 'code.html');
            if (fs.existsSync(codeHtmlPath)) {
                let content = fs.readFileSync(codeHtmlPath, 'utf8');
                if (!content.includes('navigation.js')) {
                    // Inject before closing body tag, or append
                    if (content.includes('</body>')) {
                        content = content.replace('</body>', `${scriptTag}</body>`);
                    } else {
                        content += scriptTag;
                    }
                    fs.writeFileSync(codeHtmlPath, content);
                    console.log(`Injected script into ${file.name}/code.html`);
                } else {
                    console.log(`Script already present in ${file.name}/code.html`);
                }
            }
        }
    });
});
