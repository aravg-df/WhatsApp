const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const funcsToAwait = [
  'getGroups',
  'saveGroup',
  'deleteGroup',
  'getHistory',
  'saveHistory',
  'clearHistory',
  'getSchedules',
  'saveSchedule',
  'deleteSchedule'
];

funcsToAwait.forEach(func => {
  // Replace missing awaits inside functions that are already async
  const regex = new RegExp(`(?<!await\\s+)\\b${func}\\(`, 'g');
  code = code.replace(regex, `await ${func}(`);
});

// Now we need to ensure the route handlers enclosing these are async.
// Since it's an express app, we can just find any app.get/post/put/delete that contains an await and make sure its callback is async.
code = code.replace(/app\.(get|post|put|delete)\('([^']+)',\s*\(req, res\) =>/g, "app.$1('$2', async (req, res) =>");

code = code.replace(/function updateRecipientDeliveryState/g, "async function updateRecipientDeliveryState");

fs.writeFileSync('server.ts', code);
console.log('Fixed server.ts');
