const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'stitch_smart_parking_enterprise');
const destDir = path.join(__dirname, 'src', 'pages');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

function toPascalCase(str) {
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

function convertHtmlToJsx(html) {
  let jsx = html;
  
  // Replace class= with className=
  jsx = jsx.replace(/class=/g, 'className=');
  
  // Replace HTML comments with JSX comments
  jsx = jsx.replace(/<!--(.*?)-->/gs, '{/* $1 */}');
  
  // Close self-closing tags (very basic, might need tweaking)
  jsx = jsx.replace(/<img([^>]+?)(?<!\/)>/g, '<img$1 />');
  jsx = jsx.replace(/<input([^>]+?)(?<!\/)>/g, '<input$1 />');
  jsx = jsx.replace(/<br>/g, '<br />');
  jsx = jsx.replace(/<hr([^>]*?)>/g, '<hr$1 />');
  
  // Fix inline styles
  // style="font-variation-settings: 'FILL' 1;" -> style={{ fontVariationSettings: "'FILL' 1" }}
  jsx = jsx.replace(/style="([^"]+)"/g, (match, styleStr) => {
    const styles = styleStr.split(';').filter(s => s.trim()).map(s => {
      const [key, value] = s.split(':');
      if (!key || !value) return '';
      const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
      return `${camelKey}: "${value.trim().replace(/"/g, "'")}"`;
    }).filter(s => s).join(', ');
    return `style={{ ${styles} }}`;
  });

  return jsx;
}

const files = fs.readdirSync(sourceDir, { withFileTypes: true });

const components = [];

files.forEach(file => {
  if (file.isDirectory() && file.name !== 'node_modules' && !file.name.startsWith('.')) {
    const codeHtmlPath = path.join(sourceDir, file.name, 'code.html');
    if (fs.existsSync(codeHtmlPath)) {
      const content = fs.readFileSync(codeHtmlPath, 'utf8');
      
      // Extract main content
      let mainContent = '';
      const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/);
      
      if (mainMatch) {
        mainContent = mainMatch[1];
      } else {
        // If no main, just take body minus header and aside
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/);
        if (bodyMatch) {
          mainContent = bodyMatch[1].replace(/<header[^>]*>[\s\S]*?<\/header>/, '').replace(/<aside[^>]*>[\s\S]*?<\/aside>/, '');
        } else {
          mainContent = content;
        }
      }
      
      const componentName = toPascalCase(file.name);
      components.push({ name: componentName, path: `/${file.name.replace(/_/g, '-')}` });
      
      const jsxContent = convertHtmlToJsx(mainContent);
      
      const fileContent = `import React from 'react';\n\nexport default function ${componentName}() {\n  return (\n    <>\n${jsxContent}\n    </>\n  );\n}\n`;
      
      fs.writeFileSync(path.join(destDir, `${componentName}.jsx`), fileContent);
      console.log(`Generated ${componentName}.jsx`);
    }
  }
});

// Generate App.jsx
let appJsx = `import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
`;

components.forEach(c => {
  appJsx += `import ${c.name} from './pages/${c.name}';\n`;
});

appJsx += `\nexport default function App() {\n  return (\n    <BrowserRouter>\n      <Routes>\n        <Route path="/" element={<Navigate to="/authentication-login" replace />} />\n`;
appJsx += `        <Route path="/authentication-login" element={<AuthenticationLogin />} />\n`;
appJsx += `        <Route element={<Layout />}>\n`;

components.forEach(c => {
  if (c.name !== 'AuthenticationLogin') {
    appJsx += `          <Route path="${c.path}" element={<${c.name} />} />\n`;
  }
});

appJsx += `        </Route>\n      </Routes>\n    </BrowserRouter>\n  );\n}\n`;

fs.writeFileSync(path.join(__dirname, 'src', 'App.jsx'), appJsx);
console.log('Generated App.jsx');
