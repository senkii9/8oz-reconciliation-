const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "if (!dbInstance || !user) return;\\n    const userId = user.uid;\\n\\n    // Listen to user settings and language\\n    const userDocRef = doc(dbInstance, 'users', userId);",
  "if (!dbInstance) return;\\n\\n    // Listen to store settings and language globally\\n    const userDocRef = doc(dbInstance, 'store', '8oz_main');"
);
// let's do regex
code = code.replace(/if \(!dbInstance \|\| !user\) return;\s*const userId = user\.uid;\s*\/\/ Listen to user settings and language\s*const userDocRef = doc\(dbInstance, 'users', userId\);/,
"if (!dbInstance) return;\n\n    // Listen to store settings and language globally\n    const userDocRef = doc(dbInstance, 'store', '8oz_main');");
fs.writeFileSync('src/App.tsx', code);
