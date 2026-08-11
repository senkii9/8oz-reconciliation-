const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Change useEffect
const oldEffectStart = `
  // Real-time Firestore Sync
  useEffect(() => {
    if (!dbInstance || !user) return;
    const userId = user.uid;

    // Listen to user settings and language
    const userDocRef = doc(dbInstance, 'users', userId);
`;

const newEffectStart = `
  // Real-time Firestore Sync
  useEffect(() => {
    if (!dbInstance) return;

    // Listen to store settings and language globally
    const userDocRef = doc(dbInstance, 'store', '8oz_main');
`;
code = code.replace(oldEffectStart, newEffectStart);

// Change logs collection
code = code.replace(
  "const logsCollectionRef = collection(dbInstance, 'users', userId, 'logs');",
  "const logsCollectionRef = collection(dbInstance, 'store', '8oz_main', 'logs');"
);

// Change local log migration
code = code.replace(
  "const docRef = doc(dbInstance, 'users', userId, 'logs', l.id);",
  "const docRef = doc(dbInstance, 'store', '8oz_main', 'logs', l.id);"
);
code = code.replace(
  "batch.set(docRef, { ...l, userId });",
  "batch.set(docRef, l);"
);

// Change dependency array
code = code.replace(
  "}, [dbInstance, user]);",
  "}, [dbInstance]);"
);

// Replace saving functions
code = code.replace(
  "if (dbInstance && user) {",
  "if (dbInstance) {"
); // handleSaveClosing
code = code.replace(
  "const docRef = doc(dbInstance, 'users', user.uid, 'logs', newRecord.id);",
  "const docRef = doc(dbInstance, 'store', '8oz_main', 'logs', newRecord.id);"
);

code = code.replace(
  "if (dbInstance && user) {",
  "if (dbInstance) {"
); // handleDeleteLog
code = code.replace(
  "const docRef = doc(dbInstance, 'users', user.uid, 'logs', id);",
  "const docRef = doc(dbInstance, 'store', '8oz_main', 'logs', id);"
);

code = code.replace(
  "if (dbInstance && user) {",
  "if (dbInstance) {"
); // handleSaveSettings
code = code.replace(
  "const userDocRef = doc(dbInstance, 'users', user.uid);",
  "const userDocRef = doc(dbInstance, 'store', '8oz_main');"
);

code = code.replace(
  "if (dbInstance && user) {",
  "if (dbInstance) {"
); // handleClearAllData
code = code.replace(
  "const logsCollectionRef = collection(dbInstance, 'users', user.uid, 'logs');",
  "const logsCollectionRef = collection(dbInstance, 'store', '8oz_main', 'logs');"
);

code = code.replace(
  "if (dbInstance && user) {",
  "if (dbInstance) {"
); // toggleLanguage
code = code.replace(
  "const userDocRef = doc(dbInstance, 'users', user.uid);",
  "const userDocRef = doc(dbInstance, 'store', '8oz_main');"
);

// There might be more instances, let's just use regex for all
code = code.replace(/if \(dbInstance && user\) \{/g, "if (dbInstance) {");
code = code.replace(/doc\(dbInstance, 'users', user\.uid, 'logs', ([a-zA-Z0-9_\.]+)\)/g, "doc(dbInstance, 'store', '8oz_main', 'logs', $1)");
code = code.replace(/collection\(dbInstance, 'users', user\.uid, 'logs'\)/g, "collection(dbInstance, 'store', '8oz_main', 'logs')");
code = code.replace(/doc\(dbInstance, 'users', user\.uid\)/g, "doc(dbInstance, 'store', '8oz_main')");

fs.writeFileSync('src/App.tsx', code);
